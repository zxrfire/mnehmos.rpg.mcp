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
    type InjurySource,
    type Technique,
    type TechniqueReach
} from '../../schema/cultivation.js';
import {
    REALM_TIERS,
    effectivePowerMultiplier,
    rankName,
    realmForOrdinal,
    type ImmortalStatus
} from './realms.js';
import { aggregateInjuryPenalties, createInjury, scarTempering } from './injuries.js';
import { ordinaryWoundFor } from './which-wound-an-ordinary-injury-is.js';
import { isPermanentWound } from '../../data/cultivation/wounds.js';
import { blocksAdvancement, brokenStatusOf } from './what-goes-wrong-at-a-realm-boundary.js';
import { foundationEffect, foundationOf } from './foundation.js';
import { understandingEffects, type RelevanceContext } from './understanding.js';
import { getSpiritRoot } from './spirit-roots.js';
import { readManual } from './manual-quality.js';
import { ambientBreakthroughMod } from './ambient.js';
import {
    killRequirement,
    soulAttacksAffect,
    traditionOrDefault,
    type KillRequirement,
    type TraditionId
} from './tradition.js';
import {
    resolveWeaponAgainstBody,
    weaponExposure,
    type WeaponExposure,
    type WeaponUnmade
} from './whether-a-weapon-survives-being-used.js';
import {
    ORDINARILY_YIELDS,
    type WhetherTheyYield
} from './how-far-you-went-to-make-them-comply.js';
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
 *
 * THIS IS THE BUDGET FOR ONE BODY A SIDE. `resolveMelee` scales it - see
 * `meleeRoundBudget`, and the defect it exists to fix.
 */
export const MAX_EXCHANGES = 8;

/**
 * Rounds a melee runs before it is called a stalemate.
 *
 * ── The defect ───────────────────────────────────────────────────────────
 *
 * `resolveMelee` used `MAX_EXCHANGES` directly, and that constant is
 * calibrated in its own comment for a DUEL. The two quantities it sits between
 * scale differently, and nothing noticed:
 *
 *   work to do    grows LINEARLY with the bodies on a side - each one needs
 *                 roughly four landed strikes to fall or break off.
 *   rate of work  is CAPPED. `strikesThisRound` spends `sideStrength`'s
 *                 multiplier, which is `min(MAX_NUMBERS_MULTIPLIER, ...)` = 2.
 *                 A side of fifteen lands two strikes a round, exactly as a
 *                 side of two does. That cap is correct and load-bearing -
 *                 numbers must not buy force - but it means rounds-to-resolve
 *                 grows linearly while the budget stayed constant.
 *
 * So a mobilised apex of fifteen needs about thirty rounds and was given
 * eight. Measured by the conspiracy harness at 300 seeds: `winningSideId: null`
 * in 300 of 300, every pairing, both directions. The control - the identical
 * construction at two or three a side - stalemated 0 times in 3,000. Side SIZE
 * decided whether the resolver resolved anything, which made every
 * whole-house metric structurally zero and read as "nothing is worth doing".
 *
 * That is the failure mode AGENTS.md names by title: a stalemate scored as a
 * defeat, by a harness that could not tell a beaten attacker from a clock
 * running out.
 *
 * ── The fix ──────────────────────────────────────────────────────────────
 *
 * The budget is `MAX_EXCHANGES` per body on the SMALLEST side.
 *
 * Smallest, not largest, and the difference is load-bearing. A fight ends when
 * some side is cleared, so the work that has to be finished is the work of
 * felling the side that can be felled soonest - and scaling on the largest side
 * instead hands a big weak side unlimited time to grind down somebody it cannot
 * hurt. That is numbers buying FORCE, which the charter forbids, and it broke
 * `combat.test.ts`'s load-bearing guard on the first attempt: sixty Core
 * Formation cultivators mobbed a Nascent Soul elder to death given 480 rounds,
 * where at 8 they correctly cannot touch her.
 *
 * So:
 *   duel, 1 v 1          8 rounds, exactly the calibrated constant
 *   elder v mob, 1 v 60  8 rounds. The mob gets no more clock for being a mob.
 *   apex war, 8 v 15     64 rounds against a need of about 16
 *   even war, 15 v 15    120 rounds against a need of about 30
 *
 * Numbers still buy TIME - a bigger side takes longer to chew through, and
 * everybody past the strike budget is standing there being a reason the fight
 * runs long. What they no longer buy is a longer clock to do it in.
 *
 * A stalemate stays reachable everywhere, because it is reached when neither
 * side can finish the other rather than when the clock is short - which is what
 * it was always supposed to mean.
 */
export function meleeRoundBudget(sides: readonly { members: readonly unknown[] }[]): number {
    const sizes = sides.map(side => side.members.length).filter(n => n > 0);
    const smallest = sizes.length > 0 ? Math.min(...sizes) : 0;
    return MAX_EXCHANGES * Math.max(1, smallest);
}

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
    /**
     * How badly this combatant's own OPEN CHANNEL wounds degrade the execution
     * of anything they throw, in [0, MAX_INJURY_CULTIVATION_PENALTY].
     *
     * Zero for a whole body, and zero for a maiming or a structural break -
     * those are priced as capability, on the condition and broken lines. This
     * is the torn-muscle term and it is deliberately NOT part of `total`, so it
     * cannot silently make somebody easier to hit. It is read by
     * `resolveExchange` and nowhere else. See the ACCURACY banner there.
     */
    channelWoundPenalty: number;
    /**
     * The rung and the body line ALONE, with nothing this person brought and
     * nothing they did.
     *
     * `realmBase` times the `body` factor and no other line. It exists for one
     * consumer - `whether-a-weapon-survives-being-used.ts`, which needs to ask
     * what would have happened with nobody acting - and it is computed here
     * rather than reconstructed from `factors` by a caller, because a caller
     * picking one line out of a list by its string name is a second opinion
     * about which line the body is.
     */
    bodyAlone: number;
    /**
     * The single rated object this combatant is actually swinging, or null.
     *
     * Identity, not price: `assessPower` already prices it through the artifact
     * line. What this is for is that an object is a specific thing with a
     * history, and a fight can end it - see `resolveExchange`.
     */
    weapon: CarriedObject | null;
}

/**
 * A rated object, as the engine needs to see one.
 *
 * The same shape `carriedArtifact` in `cultivation-support.ts` already returns,
 * which is the catalog's own row narrowed to what a fight needs to know: what
 * it is, so the caller can find the row again, and what it is worth, which is
 * the ladder rung the artifact catalog stores in `power`.
 */
export interface CarriedObject {
    id: string;
    name: string;
    power: number;
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
    /**
     * A single object rated on the REALM LADDER rather than on the mortal grade
     * scale, for the handful of things that are not on that scale at all.
     *
     * `artifactGrade` above prices a satchel of good work and is capped, because
     * a pile of treasures is not a realm. This is for the other kind of object -
     * something sent down by somebody who crossed, which was made at a rank and
     * still is that rank - so it is priced the way a person of that rank is
     * priced and it is not capped. Carrying one is worth, in power, a second
     * body of that ordinal standing beside you that nobody can attack.
     *
     * Deliberately no gate and no branch. This module prices what is carried; it
     * has no opinion about who is entitled to carry it, which institution the
     * bearer runs, or whether the object was earned. Take it away and the bearer
     * prices out as an ordinary cultivator at their ordinal, with no residue.
     */
    artifactOrdinal?: number;
    /**
     * The rated object they are actually swinging, when the caller knows which
     * one it is.
     *
     * The same scale as `artifactOrdinal` above and NOT a second opinion about
     * it: `weapon.power` IS the rated ordinal when no explicit `artifactOrdinal`
     * is given, so a caller states the object once and it is both priced and at
     * risk. `artifactOrdinal` stays for the caller who wants to price an object
     * without naming one, and wins if both are supplied - in which case the two
     * must describe the SAME object, because a fight that ends the named one
     * ends the price with it.
     *
     * Passing this is what puts the object in danger. A weapon far under the
     * rung it is swung into comes apart -
     * `whether-a-weapon-survives-being-used.ts` - and a caller that names no
     * weapon has nothing to lose, which is why every existing caller's seeded
     * sequence is unchanged by this field existing.
     */
    weapon?: CarriedObject | null;
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

/**
 * What a broken cultivator prices at, as a share of the rung they stand on.
 *
 * ── WHAT THE ORDERING ACTUALLY HAS TO BE, WHICH IS NOT WHAT IT WAS ───────
 *
 * This was written for a strict two-sided ordering: weaker than EVERY intact
 * holder of their realm and stronger than EVERY intact holder of the realm
 * below. That is unsatisfiable, and the arithmetic is worth keeping because it
 * is what a future attempt will rediscover. The ladder is x4 a realm and
 * `WITHIN_REALM_PEAK` is 2, so the top of one realm sits at exactly half the
 * bottom of the next: a window of x2.000, measured. The legal attribute range
 * is worth x1.516, also measured, and it widens BOTH bands the broken holder
 * has to fit between, so a strict fit needs x2.299 and has x2.000.
 *
 * The design has since said that the case which does not fit is a case it
 * WANTS. A cracked core who has been fighting for a century should be
 * dangerous to somebody who formed their core last year, and the model should
 * be allowed to say so. So the ordering that binds is the one-sided one:
 *
 *   MUST   beat every intact holder of the realm below, at every attribute
 *          spread, from any rung of their own realm.
 *   MUST   lose to a typical holder of their own rung.
 *   MAY    beat a weak one, and does, especially with battle experience behind
 *          them - which is not compressed and is worth x1.4 on its own.
 *
 * Only the first is a constraint on this number, and it is satisfiable with
 * room: it needs the share to clear the realm below's ceiling widened by the
 * attribute range, which is 0.5 x 1.516 = 0.758. Anything from there to 1 is
 * legal, and lower is better for the second requirement.
 *
 * 0.75 with the transmission exponent below lands at x1.088 of what the first
 * requirement needs while leaving a broken holder a quarter weaker than an
 * intact peer at equal attributes. It is also, deliberately, what a broken
 * status has always cost in practice: one crippling permanent wound through the
 * condition line was `1 - 0.5 x 0.5`, and the level is unchanged. What changed
 * is that it is now DECLARED here rather than falling out of `INJURY_WEIGHTS`
 * by coincidence, which is what let it drift below the line it has to clear.
 *
 * ── AND IT IS THE RUNG, NOT THE REALM ────────────────────────────────────
 *
 * A share of `combatPowerForOrdinal(ordinal)`, so a broken cultivator who
 * climbs their realm's sub-ranks gets stronger the way anybody does. They may:
 * `blocksAdvancement` gates realm boundaries and not sub-rank steps, and the
 * wound rows describe exactly this person - "forty years into being extremely
 * good at the rung they are on". Anchoring them to the realm floor instead
 * would have made those forty years worth nothing in a fight, and was only ever
 * needed for the strict ordering that has now been dropped.
 */
export const BROKEN_STATUS_POWER = 0.75;

/**
 * How much of their own strength a broken cultivator still transmits.
 *
 * An exponent rather than a second multiplier, and the difference is what buys
 * the margin. `BROKEN_STATUS_POWER` slides the broken band down; it does not
 * narrow it, so the band stays the full x1.516 of the attribute range and its
 * bottom edge is what has to clear the realm below. At 0.75 flat that edge
 * lands at x0.989 of where it needs to be - it FAILS, narrowly, and it failed
 * silently for exactly that reason: the median case looked fine.
 *
 * Raising body and comprehension to a power below 1 pulls them toward the point
 * they are defined around. Both lines are written as deviations from exactly 1
 * at median attributes, so that point is 1 and the compression is toward the
 * ordinary rather than toward anything invented. At 0.5 the band narrows to
 * x1.231 and its bottom edge clears by x1.088.
 *
 * Half, which is easy to state and easy to check: half of what this body and
 * this understanding would otherwise deliver arrives. The whole legal attribute
 * range is still worth x1.231 to a broken cultivator, so a strong one is
 * visibly stronger than a weak one, and a broken holder with the best
 * attributes in the world still prices under a median intact peer - 0.840
 * against 1.000 - which is the second requirement holding.
 *
 * Measured over all twelve legal attribute pairs on both sides at every realm
 * by `scripts/probe-how-strong-a-broken-cultivator-is.ts`, which is where any
 * future move of either constant has to be re-argued. The admissible ceiling
 * at the current attribute range is 0.943.
 *
 * What it deliberately does NOT touch: technique, artifacts, battle experience,
 * ground and condition. An art is an art, an object is worth what it is worth
 * in anybody's hand, and a bleeding cultivator is a bleeding cultivator. The
 * break is in the structure a person's OWN strength has to pass through, so
 * that is the only thing it is charged against - and leaving experience out of
 * it is what lets a broken veteran overturn a fresh peer, which the design
 * asks for by name.
 */
export const BROKEN_TRANSMISSION = 0.5;

/**
 * What a broken holder of this rung prices at, at median attributes.
 *
 * The figure the tests measure against and the one to quote when asking whether
 * somebody is worth fighting. It is a share of the rung rather than a bracket
 * of its own: `assessPower` gives a broken cultivator their rung's ordinary
 * spine and charges the break as one more line of the ordinary breakdown, so
 * "41 with cracks IS half-step 41" still holds and there is no second power
 * scale anywhere in this module.
 */
export function brokenCombatPowerForOrdinal(ordinal: number): number {
    return combatPowerForOrdinal(ordinal) * BROKEN_STATUS_POWER;
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

    // A BROKEN STATUS IS STILL NOT A RANK, AND IT IS NOT PRICED AS ONE.
    //
    // "41 with cracks IS half-step 41" - they are at the rung, they carry a
    // structural injury, and they are read out of the same wound list as
    // everybody else. What follows is not a bracket for a special kind of
    // person; it is one more line of the ordinary breakdown, minted from a
    // wound row the same way the condition line is.
    //
    // It exists because leaving the break to the ordinary injury penalty could
    // not quite do the job, and the way it failed is worth recording. That
    // penalty is FLAT - one crippling wound costs x0.750 through the condition
    // line whoever you are - and a flat penalty slides the broken band down
    // without narrowing it, so the band stays the full width of the attribute
    // range and its bottom edge is what has to clear the realm below. Measured:
    // that edge landed at x0.989 of where it needed to be. The weakest broken
    // holder lost to the strongest holder of the realm under them, which is the
    // one ordering the whole status exists to protect, and it went unnoticed
    // because the median case looked fine. See `BROKEN_TRANSMISSION`.
    const brokenStatus = brokenStatusOf(combatant.injuries);

    // ONE WOUND, ONE PRICE, PER SYSTEM. The structural break is held out of the
    // condition line because the `broken` line below is what it costs in a
    // fight. Charged in both places it would compound to x0.750 x x0.750 =
    // x0.563 against a declared x0.750, which puts a broken holder below the
    // ceiling of the realm under them - the same inversion, arrived at from the
    // other direction.
    //
    // It is held out of this line and nowhere else. It still drags on the
    // cultivation rate and on every subsequent crossing through
    // `aggregateInjuryPenalties` where those are computed, and it is still a
    // permanent wound excluded from the bleed clock. This is the combat layer
    // declining to charge for it twice, not the wound getting cheaper.
    const conditionInjuries = brokenStatus === null
        ? combatant.injuries
        : combatant.injuries.filter(i => !blocksAdvancement(i));

    const injuries = aggregateInjuryPenalties(conditionInjuries);
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
    const bodyFactor = clampFactor(bodyRaw, MAX_BODY_FACTOR);
    factors.push({
        source: 'body',
        factor: bodyFactor,
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
    const comprehensionFactor = clampFactor(comprehensionRaw, MAX_COMPREHENSION_FACTOR);
    factors.push({
        source: 'comprehension',
        factor: comprehensionFactor,
        note: `Insight ${combatant.attributes.insight}, ${understanding.contributing.length} bearing insight(s)`
    });

    // ── TECHNIQUE MASTERY ─────────────────────────────────────────────────
    // A quarter-learned art half-works. A mastered art of a matched element is
    // the difference the genre is actually about.
    const technique = combatant.technique ?? null;
    const mastery = Math.max(0, Math.min(1, combatant.techniqueMastery ?? technique?.mastery ?? 0));
    const matched =
        technique?.element != null && root.elements.includes(technique.element);
    // And how well the thing was written. A better-explained method makes a
    // better cultivator at the same rung, and it does so through the art rather
    // than as a line of its own, because it is a fact ABOUT the art.
    //
    // Priced against the reader, and the asymmetry with the cultivation rate is
    // deliberate: a method over somebody's head does not make them worse in a
    // fight, it simply does not make them better. There is no version of this
    // that is under 1 for a book you did not understand. Time you spent on the
    // wrong canon is lost; strength you never had was never yours to lose.
    const reading = readManual(technique, combatant, ctx.relevance);
    const techniqueRaw = technique === null
        ? 0.85
        : (0.6 + 0.6 * mastery) * (matched ? root.matchedTechniqueBonus : 1)
            * reading.powerMultiplier;
    factors.push({
        source: 'technique',
        factor: clampFactor(techniqueRaw, MAX_TECHNIQUE_FACTOR),
        note: technique === null
            ? 'Fighting bare, with no art at all'
            : `${technique.name} at ${(mastery * 100).toFixed(0)}% mastery`
                + `${matched ? ', element matched to the root' : ''}`
                + `${reading.powerMultiplier === 1 ? '' : `; ${reading.label.toLowerCase()}`}`
    });

    // ── ARTIFACTS ─────────────────────────────────────────────────────────
    // Two scales, one line. Graded work is a satchel of good things and is
    // capped, because a pile of treasures is not a realm. A ladder-rated object
    // is not on that scale at all: it is priced as the rank it was made at, the
    // same arithmetic a person of that rank is priced by, and it is not capped -
    // capping it would be exactly the assertion that no object can be worth what
    // a body is worth, which is the opposite of what an immortal object is.
    const gradeFactor = clampFactor(
        1 + Math.max(0, combatant.artifactGrade ?? 0) * 0.12,
        MAX_ARTIFACT_FACTOR
    );
    //
    // The rated ordinal is stated ONCE. `artifactOrdinal` prices an object the
    // caller is not naming; `weapon` names one, and naming it is what puts it
    // at risk in `resolveExchange`. They are the same number on the same scale
    // and there is deliberately no way to give two different answers for one
    // object.
    const weapon = combatant.weapon ?? null;
    const ratedOrdinal = combatant.artifactOrdinal ?? weapon?.power;
    const ratedShare = ratedOrdinal === undefined
        ? 0
        : combatPowerForOrdinal(ratedOrdinal) / realmBase;
    factors.push({
        source: 'artifacts',
        factor: gradeFactor * (1 + ratedShare),
        note:
            ((combatant.artifactGrade ?? 0) > 0
                ? `Carrying work of grade ${combatant.artifactGrade}`
                : 'Carrying nothing graded') +
            (ratedOrdinal === undefined
                ? ''
                : `, and ${weapon ? weapon.name : 'an object'} rated ${rankName(ratedOrdinal)} - worth a ` +
                  `second body of that rank, standing beside them, that nothing can be done about`)
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
    //
    // This line prices CAPABILITY, and capability cuts both ways - it is
    // divided into the advantage as the attacker's numerator and as the
    // defender's denominator, so somebody slow with a torn channel is both
    // weaker and easier to hit. That is correct and it is why the channel term
    // was left here rather than moved wholesale into the damage roll.
    //
    // What the roll adds on top is a different loss: not what you can bring but
    // how well the blow you threw arrives. See the ACCURACY banner in
    // `resolveExchange`. Two prices in two systems for two things, which is
    // what the ONE WOUND, ONE PRICE note above actually forbids doubling -
    // charging the same loss twice inside ONE system.
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
            `${injuries.untreatedCount} untreated injuries` +
            (brokenStatus === null ? '' : ' besides the break, priced on its own line below') +
            `, foundation ${foundation}`
    });

    // ── THE BREAK ────────────────────────────────────────────────
    // Last, because it is charged against lines already computed, and one line
    // rather than two so a player who asks what the break costs gets a single
    // number back rather than having to diff two breakdowns.
    //
    // It does two things and they are different:
    //
    //   level     `BROKEN_STATUS_POWER`, a flat share of the rung. This is what
    //             the break costs somebody of ordinary attributes, and it is
    //             what the break has always cost - the level is unchanged.
    //   transmit  body and comprehension - the two lines a cultivator's own
    //             strength enters through, both written as deviations from
    //             exactly 1 - are raised to `BROKEN_TRANSMISSION`, which pulls
    //             them toward that 1 rather than sliding them down. This is the
    //             part that is new, and it is what makes the one ordering the
    //             design requires - beating every intact holder of the realm
    //             below - hold at every attribute spread instead of at 99.3% of
    //             them.
    //
    // Written as a ratio against what the ordinary breakdown already produced,
    // so the multiply-in-listed-order identity still reproduces `total` exactly
    // and every other line still reads as itself.
    if (brokenStatus !== null) {
        const own = bodyFactor * comprehensionFactor;
        factors.push({
            source: 'broken',
            factor: BROKEN_STATUS_POWER * Math.pow(own, BROKEN_TRANSMISSION - 1),
            note:
                `${brokenStatus}: the structure the crossing was for did not set. ` +
                `They hold ${rankName(ordinal)} and carry ` +
                `${(100 * BROKEN_TRANSMISSION).toFixed(0)}% of what this body and this understanding ` +
                'would otherwise deliver through it'
        });
    }

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
        // The wounds go in because a rung is a claim about what a body can do
        // and a realm-boundary wound is that claim failing. A crippled nascent
        // soul cannot leave the body it is holding together, so destroying the
        // body IS the ending for somebody the ladder says it is not - which is
        // decided in `tradition.ts` and read here at the moment it is asked.
        kill: killRequirement(tradition, ordinal, combatant.injuries),
        channelWoundPenalty: openChannelPenalty(combatant.injuries),
        // The rung and the body, and nothing else. What a weapon meets when
        // nobody does anything to it.
        bodyAlone: realmBase * bodyFactor,
        weapon
    };
}

/**
 * What this body's OPEN CHANNEL wounds cost the execution of anything it does.
 *
 * Open, untreated, and not permanent - so torn meridians and scorched channels
 * and every untyped wound the engine mints, and NOT a severed meridian, a
 * ruined dantian or a broken foundation. Those are wounds of the cultivation
 * rather than of the body: they close roads, they are priced on the condition
 * and broken lines, and they are not a torn muscle. The two families are not
 * one scale (`docs/world/climbing/injuries.md`).
 */
function openChannelPenalty(injuries: readonly Injury[]): number {
    return aggregateInjuryPenalties(
        injuries.filter(i => !i.treated && !isPermanentWound(i.woundType))
    ).cultivationPenalty;
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

export type GapVerdict = 'contested' | 'outmatched' | 'helpless' | 'dominant';

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
    /** The weaker party's real branches. Present only for `helpless`. */
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

    // The mirror of `helpless`, and it was missing. Both arms of the ternary
    // that used to stand here read 'contested', so the condition was dead and
    // a Void Refinement cultivator looking DOWN at Qi Condensation Layer 5 -
    // twenty-six rungs - was told the fight was "close enough that everything
    // else decides it". Two realms is never close enough, and it has to read
    // that way from BOTH sides: the sentence the setting uses is a statement
    // about the size of the gap, not about which end of it you are standing on.
    //
    // A fourth verdict rather than reusing `helpless`, which is written from
    // the victim's side and carries REAL_OPTIONS - the branches a weaker party
    // still has. The stronger party has no such list, and that absence is the
    // whole content of the verdict.
    if (realmGap <= -HELPLESS_REALM_GAP) {
        return {
            verdict: 'dominant',
            realmGap,
            powerRatio: ratio,
            options: [],
            summary:
                `${-realmGap} major realms is not a fight. ${subject.rank} against ` +
                `${opponent.rank} is a decision the stronger party makes alone, and nothing ` +
                'carried into a direct confrontation changes that.'
        };
    }

    return {
        verdict: 'contested',
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
    /**
     * What the attacker's POSTURE this round is worth on this blow, and what
     * the defender's is worth against it. 1 for the ordinary case, which is
     * every caller that does not stand inside the fight and choose.
     *
     * Separate from `attackerEdges` because an edge is something somebody
     * BROUGHT - a formation laid, an art mastered, ground scouted - and a
     * posture is something they are doing right now instead of something else.
     * `assessEdges` prices the first against `MAX_EDGE_MULTIPLIER` and would
     * quietly spend a cap on the second.
     *
     * Both are itemised into `modifiers` under their own names, so a player who
     * guarded can see the line their guard bought. Absent or 1 pushes nothing
     * and draws nothing, so every existing caller's seeded sequence and
     * modifier list are byte-identical.
     */
    attackerPosture?: number;
    defenderPosture?: number;
    /**
     * What to call a wound this exchange leaves, when the thing that dealt it
     * is not a person.
     *
     * `resolveExchange` is the shared resolver for anything that trades force,
     * and one of its callers is not a fight at all: `site-verbs.ts` runs it
     * with the GROUND as the attacker, so somebody standing below a ruin's
     * floor was taking wounds the record called `combat`. Nobody hit them, and
     * a wound has to be a cause the game can name afterwards.
     *
     * Omitted keeps the old behaviour exactly - poison where the attacker
     * brought it, `combat` otherwise - so every existing caller's record and
     * seeded sequence are unchanged. A caller that IS a person should leave
     * this alone rather than passing `combat` explicitly; the default is the
     * statement that somebody swung.
     */
    injurySource?: InjurySource;
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
    /**
     * What the ATTACKER's rated object did against the body it was swung into.
     *
     * Null when the attacker named no weapon, which is every caller that does
     * not pass one. Reported even when the weapon held, so a player who is
     * about to lose a blade can be told how close it came - the odds are the
     * point of the mechanic and hiding them until the object is gone would make
     * it read as arbitrary.
     *
     * The object itself is NOT modified here. This module is pure with respect
     * to both combatants and it is pure with respect to their equipment for the
     * same reason: the row lives in the world layer, and the caller applies
     * `ruin` or `shatter` to it. See `WeaponUnmade.leavesFragments` for which.
     */
    weapon: WeaponAtRisk | null;
    narrationHint: string;
}

/** A named object, and what this exchange did to it. */
export interface WeaponAtRisk extends WeaponUnmade {
    objectId: string;
    objectName: string;
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
            // A blow that never arrived cannot have broken anything on the way.
            weapon: null,
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

    // What each of them is DOING this round, as against what they brought to
    // the fight. See `ExchangeContext.attackerPosture`.
    const attackerPosture = ctx.attackerPosture ?? 1;
    if (attackerPosture !== 1) {
        modifiers.push({ source: 'attacker_posture', factor: attackerPosture });
    }
    const defenderPosture = ctx.defenderPosture ?? 1;
    if (defenderPosture !== 1) {
        modifiers.push({ source: 'defender_posture', factor: 1 / defenderPosture });
    }

    let advantage = 1;
    for (const m of modifiers) advantage *= m.factor;

    // Damage is a fraction of the defender's maximum, scaled by the advantage
    // and one seeded sample. Expressed as a fraction rather than a flat number
    // so the same arithmetic works at Qi Condensation and at Grand Ascension,
    // where the absolute HP numbers are not comparable.
    const roll = ctx.rng.next();
    const share = advantage / (1 + advantage);

    // ── ACCURACY: WHAT A TORN CHANNEL COSTS THE BLOW ──────────────────────
    //
    // Design owner: "you can probably still use your dao skills, its just
    // painful for you in a way that affects the rng of the damage it does cuz
    // its slower and less accurate."
    //
    // So a wound takes the QUALITY of the execution and never the permission.
    // Nothing above this line consults `channelWoundPenalty`, and there is no
    // branch anywhere that refuses a technique to a wounded cultivator: they
    // attempt everything they could attempt whole, and it arrives worse.
    //
    // That distinction is not decoration. Gating a verb behind a wound is the
    // "banning" failure - it takes the decision away from the player and it
    // invites them to route around it by phrasing the same intent differently.
    // Degrading the outcome cannot be routed around.
    //
    // Two terms, because "slower" and "less accurate" are different losses:
    //
    //   the span   the top of the range is what goes first. A hurt cultivator
    //              can still land a blow; what they can no longer do is land
    //              their BEST one. This is the accuracy half, and it is what
    //              makes the strike unreliable rather than merely weak.
    //   the floor  charged at half, so even the worst exchange still lands
    //              something. Nobody is reduced to tickling.
    //
    // Only OPEN CHANNEL wounds - see `openChannelPenalty`. A maiming or a
    // structural break is already priced as capability on the condition and
    // broken lines, and charging it here as well would be the double-price the
    // ONE WOUND, ONE PRICE note in `assessPower` exists to prevent.
    //
    // At zero the arithmetic is byte-identical to what it was, so an unhurt
    // combatant's seeded sequence is unchanged - which is what makes this
    // measurable against the old build at all.
    const impaired = Math.max(0, Math.min(1, attacker.channelWoundPenalty));
    const fraction = share * (
        EXCHANGE_DAMAGE_FLOOR * (1 - impaired * 0.5) +
        EXCHANGE_DAMAGE_SPAN * roll * (1 - impaired)
    );
    const damage = Math.max(1, Math.round(defenderMaxHp * fraction));

    // A wound that lands hard enough leaves something that does not heal on its
    // own. Severity climbs with how one-sided the exchange was, so being
    // outclassed is how cultivators acquire the injuries that kill them later.
    let injury: Injury | null = null;
    const injuryThreshold = injuryChance(advantage, fraction);
    if (ctx.rng.next() < injuryThreshold) {
        const severity = exchangeInjurySeverity(advantage, ctx.rng);
        // Poison is a property of what the attacker BROUGHT and so outranks a
        // caller's label; past that, the caller may say what dealt this when it
        // was not a person, and the default is that somebody swung.
        const source: InjurySource = ctx.attackerEdges?.includes('poison')
            ? 'poison'
            : ctx.injurySource ?? 'combat';
        injury = createInjury(
            { severity, source, turn: ctx.turn, woundType: ordinaryWoundFor(source, severity) },
            ctx.rng
        );
    }

    // ── WHAT THE BLOW DID TO THE THING THAT THREW IT ──────────────────────
    //
    // Last, and only when there is a weapon to lose, so the seeded sequence of
    // every caller that names no object is byte-identical to what it was.
    //
    // The attacker's object against the defender's body, because that is the
    // direction the setting states it in: you swing at somebody far above you
    // and what comes back is a broken sword. It is symmetric across a fight
    // without being symmetric in one exchange - the defender swings on their own
    // turn and their own object is at risk then, resolved by this same call with
    // the roles the other way round.
    //
    // Nothing here is gated on who anybody is. The reason a Core Formation
    // cultivator is not walking around with an object rated forty-five is not a
    // rule; it is that somebody stronger wants it. This module has no opinion.
    const weaponAtRisk = attacker.weapon === null
        ? null
        : atRisk(attacker.weapon, defender, ctx.rng);

    return {
        damage,
        injury,
        nullified: false,
        nullifiedReason: null,
        vector,
        advantage,
        roll,
        modifiers,
        weapon: weaponAtRisk,
        narrationHint:
            `${attacker.rank} strikes at ${defender.rank}${vector === 'soul' ? ', at the soul' : ''}. ` +
            `Advantage ${advantage.toFixed(2)}; ${damage} damage` +
            (injury ? `, and a ${injury.severity} meridian injury that will not close on its own.` : '.') +
            (weaponAtRisk?.broke ? ` ${weaponAtRisk.objectName} did not survive it. ${weaponAtRisk.narrationHint}` : '')
    };
}

/**
 * Put one named object through the body it was swung into.
 *
 * The whole of the arithmetic is in
 * `whether-a-weapon-survives-being-used.ts`; what lives here is the translation
 * from a priced combatant into the four numbers that module asks for, which is
 * the only thing this file knows that it does not.
 */
function atRisk(
    object: CarriedObject,
    metBy: CombatantPower,
    rng: CultivationRNG
): WeaponAtRisk {
    const unmade = resolveWeaponAgainstBody(
        {
            weaponPower: object.power,
            weaponStanding: combatPowerForOrdinal(object.power),
            metBy: metBy.total,
            metByBodyAlone: metBy.bodyAlone,
            metByOrdinal: metBy.ordinal,
            factors: metBy.factors,
            standingOf: combatPowerForOrdinal
        },
        rng
    );
    return { ...unmade, objectId: object.id, objectName: object.name };
}

/**
 * What a fight would do to an object, without fighting one.
 *
 * The odds a player is owed BEFORE they swing. Every other gated-then-rolled
 * system in this engine shows its number first - a breakthrough, a crossing, a
 * refinement - and equipment should not be the one place the engine keeps the
 * arithmetic to itself until after it has taken something.
 */
export function weaponAgainst(object: CarriedObject, metBy: CombatantPower): WeaponExposure {
    return weaponExposure({
        weaponPower: object.power,
        weaponStanding: combatPowerForOrdinal(object.power),
        metBy: metBy.total,
        metByBodyAlone: metBy.bodyAlone,
        metByOrdinal: metBy.ordinal,
        factors: metBy.factors,
        standingOf: combatPowerForOrdinal
    });
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
    /**
     * Beaten, alive, and yielding.
     *
     * The sixth, and the only outcome that leaves you with a PERSON rather than
     * a corpse or an empty road. Design owner: *"I should be able to force
     * someone to submit to me."* What makes it worth having is what it leaves
     * standing - somebody who owes you, is under you, can be made to do
     * something, and will remember it - and that is a live relationship where
     * every other ending is the end of one.
     *
     * It is reached from `goal: 'coerce'` and ONLY when the loser actually
     * yields. Submission is not what losing means: whether somebody kneels is a
     * fact about who they are, read by the caller off records the world already
     * keeps, and somebody who would rather die does, which turns a fight you
     * opened meaning to take somebody alive into a body you did not want. See
     * `ConfrontationIntent.yields`.
     *
     * What KIND of thing you are left with is not decided here and must not be.
     * Below `BEAST_CHANGE_ORDINAL` the thing that yielded is an animal you now
     * have; at or above it, it is a person under an obligation, which is an
     * indenture. The act is identical and this module has no opinion about what
     * shape was standing there - the caller holds the row and decides.
     */
    | 'submission'
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
    /**
     * What the aggressor is actually trying to do. Decides which endings are
     * reachable.
     *
     * `coerce` is the fifth and it is the `done` rung of
     * `how-far-you-went-to-make-them-comply.ts`: harm applied to get compliance
     * rather than to end anybody. It wants them complying and still standing,
     * where `kill` wants them stopped - which is the whole of the difference,
     * because the blows in between are the same blows. It reaches `submission`
     * when they yield and the ordinary killing outcomes when they will not.
     */
    goal: 'kill' | 'subdue' | 'drive_off' | 'humiliate' | 'coerce';
    /** Whether the loser will break off rather than be finished. Usually yes. */
    willWithdraw?: boolean;
    /**
     * Whether the beaten party yields rather than being finished.
     *
     * READ BY THE CALLER, off records the world already keeps - a person's
     * wants and their standing toward whoever is in the room, a beast's own
     * nature. There is deliberately no will-to-submit number anywhere in the
     * engine and there must not be one: submission is a fact about who somebody
     * is, and every fact about who somebody is already lives somewhere.
     *
     * Omitted reads as `ORDINARILY_YIELDS`, because most people beaten badly
     * enough do. That is a default and not a rule, which is what keeps the
     * interesting case reachable: somebody who would rather die is finished
     * instead, and the aggressor gets a body they did not want.
     */
    yields?: WhetherTheyYield;
    /**
     * How the fight was opened.
     *
     * `from_concealment` is a different act from squaring up, and the
     * difference is what it buys and what it costs socially rather than a
     * second combat system. Two things change, both of them inside the rules
     * that already exist:
     *
     *   the first exchange carries the `ambush` edge, which
     *   `EDGE_VALUES` has priced at 1.5 since before this field existed and
     *   whose own comment says "Once. Never twice against the same person" -
     *   so it is applied to the opening exchange and to no other.
     *
     *   the target does not swing back in the opening round. They did not know
     *   they were in a fight, which is the whole content of concealment, and it
     *   is worth more than the multiplier.
     *
     * What it does NOT change is what a blow does to a body. Softening or
     * hardening the physics on the strength of how the fight started would be
     * two sets of rules reachable by choosing your words. What it changes
     * besides the opening is what the deed says about you, which is the
     * caller's business and is where an ambush actually costs something.
     *
     * NO NEW DRAW when this is absent or `open`: the seeded sequence of every
     * existing caller is byte-identical, which is what makes the change
     * measurable at all.
     */
    opening?: 'open' | 'from_concealment';
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
    /**
     * Objects that did not survive the fight, in the order they went.
     *
     * The rows are NOT modified - this module owns no object table. What the
     * caller does with these is apply `ruin` or, above `FRAGMENTS_AT_OR_ABOVE`,
     * `shatter`, and either way the provenance chain keeps the entry, because a
     * thing that vanishes cleanly from the record is a thing nobody can ever be
     * asked about.
     */
    brokenObjects: Array<{ carrierId: string; breakerId: string; broke: WeaponAtRisk }>;
    obligations: ObligationSeed[];
    narrationHint: string;
}

// ═════════════════════════════════════════════════════════════════════════
// ONE ROUND
//
// A confrontation is a loop over rounds, and until this section existed the
// loop was inside `resolveConfrontation` and nothing else could reach it. That
// made the whole fight a single call, which is fine for two NPCs meeting on a
// road at the far end of a time skip and is not fine for the person playing:
//
//   > combat should also of course resolve across multiple turns to give the
//   > player agency (fleeing, how, to where, using what ability, or item?). if
//   > you fought and it resolves in one turn and you died it would be
//   > unsatisfying cuz there's nothing you can do about it.
//
// So the round is lifted out and both entrances go through it. There is not a
// player fight and an NPC fight; there is one round function, called eight
// times in a row by `resolveConfrontation` and once per turn by a caller that
// is holding a fight open for somebody. The physics cannot drift because there
// is only one copy of them.
//
// What the two entrances genuinely differ in is WHO CHOOSES, and that is the
// whole of `RoundAct`. `resolveConfrontation` chooses `strike` for both sides
// every round, which is exactly what it did before this existed, so its seeded
// sequence is unchanged.
// ═════════════════════════════════════════════════════════════════════════

/**
 * RULE 1, before anything is rolled: whether there is a fight here at all.
 *
 * Returns a finished result when the gap has already decided it, and null when
 * there is something to resolve. Lifted out of `resolveConfrontation` for the
 * same reason the round was: a caller holding a fight open across turns has to
 * ask this question first and must get the same answer, or the two entrances
 * disagree about who can be fought - which would be the categorical gap, the
 * load-bearing claim of the whole setting, holding in one place and not the
 * other.
 *
 * `hp` and `injuries` are the running totals, handed in so the returned result
 * carries them.
 */
export function theGapDecidesItAlone(
    aggressorInput: CombatantInput,
    defenderInput: CombatantInput,
    aggressor: CombatantPower,
    defender: CombatantPower,
    gap: GapAssessment,
    ctx: ConfrontationContext,
    hp: Record<string, number>,
    injuries: Record<string, Injury[]>
): ConfrontationResult | null {
    // Checked in both directions: an aggressor who is helpless against their
    // target achieves nothing, and an aggressor several realms above one does
    // not have a fight either - they have a decision.
    const reverseGap = assessGap(defender, aggressor);
    if (gap.verdict === 'helpless') {
        // NOT NOTHING. The fight does not happen and the swing does.
        //
        // "Swing a sword at someone two realms above and they shatter it" is the
        // design owner's own example, and two realms is exactly where
        // `HELPLESS_REALM_GAP` stops the fight - so if the object were only put
        // at risk inside the exchange loop, the one case everybody quotes would
        // be the one case the engine had nothing to say about.
        //
        // The gap being categorical is a statement about what the aggressor can
        // do to the DEFENDER. It is not a statement about what the defender's
        // body does to a piece of metal swung into it, and at this distance
        // `weaponExposure` reaches certainty on the body alone, so nothing is
        // rolled here either: it is not luck, it is what happens.
        const swung = aggressor.weapon === null ? null : atRisk(aggressor.weapon, defender, ctx.rng);
        return noContest(aggressor, defender, gap, hp, injuries, aggressorInput.id, defenderInput.id,
            `${aggressorInput.name} cannot reach ${defenderInput.name}. ${gap.summary}` +
            (swung?.broke ? ` ${swung.objectName} did not survive the attempt. ${swung.narrationHint}` : ''),
            swung?.broke
                ? [{ carrierId: aggressorInput.id, breakerId: defenderInput.id, broke: swung }]
                : []);
    }
    if (reverseGap.verdict === 'helpless') {
        return oneSided(aggressor, defender, gap, ctx, aggressorInput, defenderInput, hp, injuries);
    }
    return null;
}

/**
 * What somebody is doing with their round.
 *
 * Three postures on ONE axis, and that is deliberate: a round is a fixed amount
 * of attention, and all three answers are about where it went. Guarding spends
 * it on not being hit and has nothing left to swing with; pressing spends it on
 * the blow and leaves nothing over to keep anybody off you; striking is the
 * ordinary even split and is what everybody does when nobody chose.
 *
 * There is no fourth. A posture that both raised your blow and lowered theirs
 * would be a free lunch, and a fight in which one answer dominates is a fight
 * with no decision in it.
 */
export type RoundAct =
    /** The ordinary exchange. Swing, and take what comes back. */
    | 'strike'
    /** Spend the round on not being hit. No blow of your own. */
    | 'guard'
    /** Spend the round on the blow. Theirs lands the harder for it. */
    | 'press';

/**
 * What a posture is worth, in either direction.
 *
 * DERIVED, NOT CHOSEN. It is the cheapest entry in `EDGE_VALUES`, and the
 * reasoning is that a posture is the one advantage in this engine that costs
 * NOTHING to have: anybody can guard, at any rung, with no art, no preparation
 * and no ground. So it must be worth no more than the cheapest thing somebody
 * had to go and get, which is `terrain` - free to use and not free to find.
 *
 * Read off the table rather than restated, so it cannot drift from it. If the
 * cheapest edge is ever repriced this moves with it, which is correct: the
 * claim being made is "no better than the cheapest edge", not a number.
 */
export const POSTURE_WORTH = Math.min(...Object.values(EDGE_VALUES));

/** One side of a round: the row, its price, and what it is doing with the round. */
export interface RoundParty {
    /** The row, with anything already lost taken off it. */
    input: CombatantInput;
    /** That row, priced. Re-priced by the round when a weapon goes. */
    power: CombatantPower;
    act: RoundAct;
    /** What they brought to the fight, as against what they are doing this round. */
    edges: readonly Edge[];
    /** Where they are aiming, for an art that can choose. */
    vector: AttackVector;
}

export interface RoundContext {
    rng: CultivationRNG;
    ambient: AmbientQi;
    /** Stamped onto any injury the round produces. */
    turn: number;
    /** The first round of the whole fight. */
    opening: boolean;
    /**
     * The aggressor came out of concealment. Only ever meaningful on the
     * opening round: the ambush edge is worth it once, and the target does not
     * swing back in the round they did not know they were in.
     */
    fromConcealment: boolean;
    /** Whether a side under `WITHDRAW_HP_FRACTION` breaks off on its own. */
    willWithdraw: boolean;
}

export interface RoundResult {
    /** In the order they were thrown. `index` is the caller's to stamp. */
    exchanges: Array<Omit<ExchangeRecord, 'index'>>;
    brokenObjects: ConfrontationResult['brokenObjects'];
    /** Both sides as they now stand, re-priced if anything came apart. */
    aggressor: RoundParty;
    defender: RoundParty;
    winnerId: string | null;
    loserId: string | null;
    /** Why the fight ended, when the round ended it. */
    ending: 'down' | 'withdrew' | null;
}

/**
 * Resolve one round between two priced combatants.
 *
 * `hp` and `injuries` are the running totals and ARE written to, because a
 * round is an event in a fight rather than a question about one - the same
 * thing `resolveConfrontation` has always done to its own locals. Everything
 * else is returned.
 *
 * Nothing here decides an ending beyond "somebody is down" and "somebody broke
 * off under the floor". What that ending MEANS - a killing, a capture, a
 * submission, a body destroyed - is `concludeConfrontation`'s, because it turns
 * on the goal and the tradition and not on the blow.
 */
export function resolveConfrontationRound(
    aggressorSide: RoundParty,
    defenderSide: RoundParty,
    hp: Record<string, number>,
    injuries: Record<string, Injury[]>,
    ctx: RoundContext
): RoundResult {
    const powerCtx: PowerContext = { ambient: ctx.ambient };
    let aggressor = aggressorSide;
    let defender = defenderSide;

    const exchanges: RoundResult['exchanges'] = [];
    const brokenObjects: ConfrontationResult['brokenObjects'] = [];
    let winnerId: string | null = null;
    let loserId: string | null = null;
    let ending: RoundResult['ending'] = null;

    // `assessEdges` de-duplicates, so an aggressor already carrying an ambush
    // edge from somewhere else is not paid for it twice.
    const openingEdges: readonly Edge[] = ctx.opening && ctx.fromConcealment
        ? [...aggressorSide.edges, 'ambush']
        : aggressorSide.edges;

    // The aggressor swings, then the defender swings back if still standing.
    // Held as WHO is striking rather than as the priced pair, so a weapon lost
    // on the first swing of a round is already gone on the second.
    const order: boolean[] = [true, false];
    // The target had no round. Nothing is rolled for them, which is why an open
    // fight's seeded sequence is untouched by concealment existing.
    if (ctx.opening && ctx.fromConcealment) order.pop();

    for (const aggressorStrikes of order) {
        const striker = aggressorStrikes ? aggressor : defender;
        const target = aggressorStrikes ? defender : aggressor;
        if (hp[striker.input.id] <= 0) continue;

        // A guard has no blow in it. That is the whole of what it costs, and it
        // is charged by there being nothing here to resolve - not by a
        // multiplier that would have to be believed.
        if (striker.act === 'guard') continue;

        const result = resolveExchange(striker.power, target.power, target.input.maxHp, {
            rng: ctx.rng,
            ambient: ctx.ambient,
            turn: ctx.turn,
            // The aggressor's own aim; the defender always answers at the body,
            // which is what this loop has always done.
            vector: aggressorStrikes ? striker.vector : 'body',
            attackerEdges: aggressorStrikes ? openingEdges : striker.edges,
            defenderEdges: target.edges,
            // Pressing puts the round into the blow. Guarding puts it into not
            // being hit, and a guard that never gets to swing still gets this.
            attackerPosture: striker.act === 'press' ? POSTURE_WORTH : 1,
            defenderPosture: target.act === 'guard'
                ? POSTURE_WORTH
                : target.act === 'press' ? 1 / POSTURE_WORTH : 1
        });

        hp[target.input.id] = Math.max(0, hp[target.input.id] - result.damage);
        if (result.injury) injuries[target.input.id].push(result.injury);

        // The object went. Take it off the person who was swinging it and price
        // them again, so the rest of the fight is fought without it.
        if (result.weapon?.broke) {
            brokenObjects.push({
                carrierId: striker.input.id,
                breakerId: target.input.id,
                broke: result.weapon
            });
            const stripped = { ...striker.input, weapon: null, artifactOrdinal: undefined };
            const repriced: RoundParty = {
                ...striker,
                input: stripped,
                power: assessPower(stripped, powerCtx)
            };
            if (aggressorStrikes) aggressor = repriced; else defender = repriced;
        }

        exchanges.push({
            attackerId: striker.input.id,
            defenderId: target.input.id,
            result,
            defenderHpAfter: hp[target.input.id]
        });

        if (hp[target.input.id] <= 0) {
            winnerId = striker.input.id;
            loserId = target.input.id;
            ending = 'down';
            break;
        }

        // Breaking off is the ordinary end of a cultivation fight. Somebody
        // decides the price has stopped being worth it and goes.
        if (ctx.willWithdraw && hp[target.input.id] < target.input.maxHp * WITHDRAW_HP_FRACTION) {
            winnerId = striker.input.id;
            loserId = target.input.id;
            ending = 'withdrew';
            break;
        }
    }

    return { exchanges, brokenObjects, aggressor, defender, winnerId, loserId, ending };
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
    // Re-priced, not constant. A cultivator who loses their weapon mid-fight is
    // a weaker cultivator for the rest of it - which is the whole content of
    // "bring a bad weapon and you brought nothing", and it would be a claim the
    // engine made and did not honour if the price were taken once at the top.
    let aggressor = assessPower(aggressorInput, powerCtx);
    let defender = assessPower(defenderInput, powerCtx);
    const gap = assessGap(aggressor, defender);
    const brokenObjects: ConfrontationResult['brokenObjects'] = [];

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
    const settledAlready = theGapDecidesItAlone(
        aggressorInput, defenderInput, aggressor, defender, gap, ctx, hp, injuries
    );
    if (settledAlready) return settledAlready;

    // ── Exchanges. ──
    const exchanges: ExchangeRecord[] = [];
    let outcome: ConfrontationOutcome = 'stalemate';
    let winnerId: string | null = null;
    let loserId: string | null = null;

    const vector: AttackVector = ctx.vector ?? 'body';
    const willWithdraw = ctx.intent.willWithdraw ?? true;

    // The inputs are re-read rather than captured, because a broken weapon
    // changes them. `aggressorLive` and `defenderLive` are the same rows with
    // whatever they have lost taken off.
    let aggressorLive = aggressorInput;
    let defenderLive = defenderInput;

    // ── OPENING FROM CONCEALMENT ─────────────────────────────────────────
    //
    // Applied to the first round and to no other. `EDGE_VALUES.ambush` already
    // carries the reason in its own comment - "Once. Never twice against the
    // same person" - so the edge is added to the opening exchange, and the
    // target, who did not know they were in a fight, does not swing back in it.
    //
    // Both halves are `resolveConfrontationRound`'s now; this only says whether
    // it happened.
    const fromConcealment = ctx.intent.opening === 'from_concealment';

    // BOTH SIDES STRIKE, EVERY ROUND, WHICH IS WHAT THIS LOOP HAS ALWAYS DONE.
    //
    // Nobody standing inside this call is choosing anything: it is two people
    // meeting and the whole thing being settled. A posture is a decision, and a
    // decision needs somebody to make it, which is what the round-at-a-time
    // entrance is for. `POSTURE_WORTH` is never applied here and no draw
    // changes, so this resolver's seeded sequence is exactly what it was.
    let aggressorSide: RoundParty = {
        input: aggressorLive, power: aggressor, act: 'strike',
        edges: ctx.attackerEdges ?? [], vector
    };
    let defenderSide: RoundParty = {
        input: defenderLive, power: defender, act: 'strike',
        edges: ctx.defenderEdges ?? [], vector: 'body'
    };

    for (let i = 0; i < MAX_EXCHANGES; i++) {
        const round = resolveConfrontationRound(aggressorSide, defenderSide, hp, injuries, {
            rng: ctx.rng,
            ambient: ctx.ambient,
            turn: ctx.turn,
            opening: i === 0,
            fromConcealment,
            willWithdraw
        });

        aggressorSide = round.aggressor;
        defenderSide = round.defender;
        aggressor = aggressorSide.power;
        defender = defenderSide.power;
        aggressorLive = aggressorSide.input;
        defenderLive = defenderSide.input;
        brokenObjects.push(...round.brokenObjects);
        for (const e of round.exchanges) exchanges.push({ ...e, index: exchanges.length });

        if (round.winnerId !== null) {
            winnerId = round.winnerId;
            loserId = round.loserId;
            if (round.ending === 'withdrew') outcome = 'withdrawal';
            break;
        }
    }

    if (winnerId === null) {
        return stalemate(aggressor, defender, gap, exchanges, hp, injuries, aggressorInput, defenderInput, brokenObjects);
    }

    return concludeConfrontation({
        aggressorInput, defenderInput, aggressor, defender, gap, ctx,
        exchanges, hp, injuries, brokenObjects,
        winnerId, loserId: loserId!, endedBy: outcome === 'withdrawal' ? 'withdrew' : 'down'
    });
}

/** Everything a finished fight knows about itself, whoever ran the rounds. */
export interface ConcludeInput {
    aggressorInput: CombatantInput;
    defenderInput: CombatantInput;
    /** Both sides as they stood at the end, re-priced for anything lost. */
    aggressor: CombatantPower;
    defender: CombatantPower;
    gap: GapAssessment;
    ctx: ConfrontationContext;
    exchanges: ExchangeRecord[];
    hp: Record<string, number>;
    injuries: Record<string, Injury[]>;
    brokenObjects: ConfrontationResult['brokenObjects'];
    winnerId: string;
    loserId: string;
    /** Down on the ground, or broke off under the floor. */
    endedBy: 'down' | 'withdrew';
    /**
     * What the loser's own HP was when the fight OPENED, for the line that says
     * whether the winner was touched. Defaults to the input rows, which is right
     * for a fight that ran start to finish in one call and wrong for one that
     * was carried across turns from an already-hurt body.
     */
    hpAtOpening?: Record<string, number>;
}

/**
 * What the ending MEANT.
 *
 * Split out of `resolveConfrontation` so that a fight taken a round at a time
 * ends the same way one settled in a single call does. Everything in here turns
 * on the goal, the tradition and the wounds - never on how many turns the
 * player spent getting here - so there is exactly one answer to "what happened
 * to the loser" and both entrances get it.
 */
export function concludeConfrontation(input: ConcludeInput): ConfrontationResult {
    const {
        aggressorInput, defenderInput, aggressor, defender, gap, ctx,
        exchanges, hp, injuries, brokenObjects, winnerId, loserId
    } = input;
    const vector: AttackVector = ctx.vector ?? 'body';
    let outcome: ConfrontationOutcome = input.endedBy === 'withdrew' ? 'withdrawal' : 'stalemate';

    const loserInput = loserId === aggressorInput.id ? aggressorInput : defenderInput;
    const loserPower = loserId === aggressorInput.id ? aggressor : defender;
    const requirement = loserPower.kill;

    // ── RULE 5 and RULE 4. What actually happened to the loser. ──
    //
    // COERCION IS RESOLVED HERE AND NOT IN `finishOutcome`, because it is the
    // one goal whose ending is not decided by the goal. The aggressor wanted
    // them complying and still standing; whether that is what they get is a
    // fact about the person they beat.
    //
    // It also overrides a withdrawal, which is the point at which somebody
    // beaten decides. Left alone, `willWithdraw` would have ended almost every
    // coercion as somebody running away, which is the one thing a coercion is
    // not for.
    const yields = ctx.intent.yields ?? ORDINARILY_YIELDS;
    const coercing = ctx.intent.goal === 'coerce' && winnerId === aggressorInput.id;
    if (coercing) {
        // They yield, or they do not and the fight finishes them. A body the
        // aggressor did not want is the honest price of having gone this far
        // against somebody who would rather die.
        outcome = yields.willYield ? 'submission' : finishOutcome('kill', vector, requirement);
        if (!yields.willYield) hp[loserInput.id] = 0;
    } else if (outcome !== 'withdrawal') {
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

    const openedOn = input.hpAtOpening ?? {
        [aggressorInput.id]: aggressorInput.hp,
        [defenderInput.id]: defenderInput.hp
    };

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
        brokenObjects,
        obligations: seedObligations(outcome, winnerId, loserId, loserInput.name, loserInjuries),
        // WHETHER THE WINNER WAS TOUCHED IS PART OF WHAT HAPPENED.
        //
        // The same defect as the one-sided path, one size smaller and reachable
        // in ordinary play: the aggressor strikes first, and a single blow that
        // puts the defender under `WITHDRAW_HP_FRACTION` breaks the loop before
        // the defender ever swings. The winner is then on full HP and the
        // withdrawal line still said "both parties are worse than they were".
        // It is read off the running total rather than assumed, because the
        // resolution already knows.
        narrationHint: describeOutcome(
            outcome, requirement, remnant,
            hp[winnerId] < openedOn[winnerId]
        )
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
    // A coercion that reaches here is one whose target would not yield, and the
    // caller has already asked and been told so. What is left is a fight being
    // finished, which is what the caller passes 'kill' for.
    if (goal === 'coerce') return 'submission';
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
        case 'submission':
            // Heavier than a capture, and the reason is the whole difference
            // between the two. Being taken is something done to a body;
            // yielding is a thing the person themselves did, in front of
            // whoever was there, and they cannot tell themselves afterwards
            // that they had no choice - they had one and this is the one they
            // took. The grudge that produces is the durable kind.
            //
            // The compliance is NOT modelled here. What somebody now owes and
            // for how long is the obligation layer's, and holding a person for a
            // term is an indenture; this seeds the grievance that comes with it,
            // which is the half that outlives the term.
            return [{
                kind: 'grudge',
                holderId: loserId,
                subjectId: winnerId,
                cause: 'humiliation',
                severity: 'grave',
                description:
                    `${loserName} was beaten and yielded rather than be finished, and is now `
                    + 'under the person who beat them.'
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
    remnant: 'soul' | 'seam' | null,
    /** Whether the party still standing actually took anything. */
    winnerWasHurt = true
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
            return winnerWasHurt
                ? 'Broken off. Both parties are worse than they were, the wounds are real, and nothing is settled.'
                : 'Broken off, and only one way. They went before they could answer, the wounds are real and ' +
                  'all on one side, and the party still standing has not been touched.';
        case 'crippled':
            return 'They walked away carrying something that will not close. That is the ratchet, and it is what ' +
                'eventually kills most cultivators who survive their fights.';
        case 'capture':
            return 'Taken alive. What happens next is a negotiation, and the terms are not theirs.';
        case 'humiliation':
            return 'Beaten and let go, deliberately, where it could be seen. The cheapest way to make a permanent enemy.';
        case 'submission':
            return 'Beaten, alive, and yielding. The only ending that leaves somebody standing who is now under ' +
                'the person who beat them: they owe something, they can be made to do something, and they will ' +
                'remember every part of it.';
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
    hint: string,
    brokenObjects: ConfrontationResult['brokenObjects'] = []
): ConfrontationResult {
    return {
        outcome: 'no_contest',
        winnerId: null,
        loserId: null,
        aggressor,
        defender,
        gap,
        brokenObjects,
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
 * What a one-sided resolution actually was, said in one voice.
 *
 * `describeOutcome` is written for a CONTESTED fight and every line of it
 * assumes two people traded blows - "both parties are worse than they were",
 * "nothing is settled", "neither could finish it". None of that is true when
 * the aggressor stood realms above and the defender never got to swing, so
 * pasting the two together produced the flat contradiction this function
 * exists to make impossible:
 *
 *   "There was no exchange to resolve. Broken off. Both parties are worse
 *    than they were, the wounds are real, and nothing is settled."
 *
 * Composed from two fragments that did not know about each other, against a
 * result where the aggressor was untouched at full HP, the defender was at a
 * fifth of theirs and carrying a wound that does not close, and the matter was
 * entirely settled. The rule this restates: the outcome decides the sentence,
 * and one function writes the whole sentence.
 */
function describeOneSided(
    outcome: ConfrontationOutcome,
    requirement: KillRequirement,
    remnant: 'soul' | 'seam' | null
): string {
    switch (outcome) {
        case 'lethal':
            return `They were finished where they stood, and nothing about it was uncertain. ${requirement.note}`;
        case 'body_destroyed':
            return remnant === 'soul'
                ? 'The body was taken apart without a contest, and the person was not. The soul left intact and ' +
                  'can persist for months, shortening every day it stays out - so the party who walked away ' +
                  'certain of what they had done is the one who will be surprised.'
                : 'The body was taken apart without a contest, and the seam was not. A large enough seam-bearing ' +
                  'piece regrows over years into somebody who remembers exactly who did this and how easy they ' +
                  'found it.';
        case 'withdrawal':
            return 'Driven off, one-sidedly and settled. They are hurt, they are carrying something that will ' +
                'not close on its own, and the party who did it is untouched. What they take away is not a ' +
                'grievance about a fight - it is the measurement.';
        case 'capture':
            return 'Taken, not beaten - there was nothing to beat. What happens next is a negotiation, and no ' +
                'part of the terms is theirs.';
        case 'humiliation':
            return 'Put down without effort, deliberately, where it could be seen. Nothing was risked and ' +
                'everything was demonstrated, which is the cheapest way to make a permanent enemy.';
        case 'submission':
            return 'Made to kneel, without a contest. They yielded because there was nothing else on the table, ' +
                'and they are alive, under the person who did it, and entirely clear about the arithmetic.';
        case 'crippled':
        case 'stalemate':
        case 'no_contest':
            // Unreachable: `oneSided` only ever mints the six above, and
            // `no_contest` returns before it. Kept total so a new outcome
            // cannot silently fall through to a contested-fight sentence.
            return 'Settled in one action by the stronger party, at no risk to them.';
    }
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
    // The sixth ending, reachable from here too. Somebody several realms below
    // you being made to kneel is the case the outcome exists for, and it was
    // the one place it could not have happened - which would have made "I can
    // force somebody to submit" true of peers and false of everybody the
    // sentence obviously means.
    //
    // And it is refusable at this distance exactly as it is at any other. A
    // reading that says they would rather die is believed here too, and the
    // stronger party gets the body instead: no branch anywhere makes somebody
    // more biddable for having been outmatched.
    const yields = ctx.intent.yields ?? ORDINARILY_YIELDS;
    const refusedToKneel = goal === 'coerce' && !yields.willYield;
    const outcome: ConfrontationOutcome = goal === 'kill' || refusedToKneel
        ? finishOutcome('kill', vector, requirement)
        : goal === 'subdue' ? 'capture'
            : goal === 'humiliate' ? 'humiliation'
                : goal === 'coerce' ? 'submission'
                    : 'withdrawal';

    if (goal === 'kill' || refusedToKneel) {
        hp[defenderInput.id] = 0;
    } else {
        hp[defenderInput.id] = Math.max(1, Math.floor(defenderInput.maxHp * 0.2));
        injuries[defenderInput.id].push(
            createInjury({ severity: 'serious', source: 'combat', turn: ctx.turn, woundType: ordinaryWoundFor('combat', 'serious') }, ctx.rng)
        );
    }

    return {
        outcome,
        // Nobody's object is at risk here. The stronger party's weapon is not
        // outclassed by anything in the room, and the weaker party never got to
        // swing - which is what one-sided means.
        brokenObjects: [],
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
        // ── WHAT WAS DONE, NOT WHAT WAS NOT ──────────────────────────────
        //
        // The old hint led with "there was no exchange to resolve" and then
        // handed the rest of the sentence to the contested-fight vocabulary,
        // which read as nothing having happened while the row underneath said
        // a fifth of a body and an untreated wound. So the count of exchanges
        // is stated as a fact ABOUT the resolution rather than as a substitute
        // for it, and every consequence this function actually applied is
        // named - because a narrator that is told the number cannot write that
        // nothing happened.
        narrationHint:
            `${aggressorInput.name} stands ${-gap.realmGap} major realms above ${defenderInput.name}, ` +
            'so this resolved in one action with nothing contested and no exchange rolled. ' +
            describeOneSided(outcome, requirement, outcome === 'body_destroyed' ? requirement.remnant : null) +
            ` ${defenderInput.name} is left at ${hp[defenderInput.id]}/${defenderInput.maxHp}` +
            (injuries[defenderInput.id].length > 0
                ? ` and carrying a ${injuries[defenderInput.id][0].severity} wound that will not close on its own.`
                : '.') +
            ` ${aggressorInput.name} took nothing.`
    };
}

export function stalemate(
    aggressor: CombatantPower,
    defender: CombatantPower,
    gap: GapAssessment,
    exchanges: ExchangeRecord[],
    hp: Record<string, number>,
    injuries: Record<string, Injury[]>,
    aggressorInput: CombatantInput,
    defenderInput: CombatantInput,
    brokenObjects: ConfrontationResult['brokenObjects'] = []
): ConfrontationResult {
    return {
        outcome: 'stalemate',
        winnerId: null,
        loserId: null,
        brokenObjects,
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
        ? createInjury({ severity: 'serious', source: 'combat', turn: ctx.turn, woundType: ordinaryWoundFor('combat', 'serious') }, ctx.rng)
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

// ═════════════════════════════════════════════════════════════════════════
// SIDES
//
// Everything above this line resolves one aggressor against one defender.
// Most of what this world does with violence is not that: a raiding party
// against a hall, a court's seniors against a client sect, two houses' woken
// ancestors arriving at the same hour on the same person. None of it involves
// the player and all of it has to resolve.
//
// The five rules do not change here. What changes is that a combatant now
// stands on a SIDE, and the question the group layer has to answer - the only
// genuinely new question in it - is what a second body is worth.
//
// WHAT NUMBERS ARE WORTH, AND WHY IT IS NOT N
// -------------------------------------------
// The naive answer resolves itself and is wrong. Let everybody strike once a
// round at whoever is in front of them, price each strike off the striker's
// power, and the arithmetic that falls out is Lanchester's square law: N
// attackers beat a defender R times stronger whenever N-squared exceeds R.
// A realm is worth four, so three Foundation cultivators would take a Core
// Formation elder and four would take a Nascent Soul one. That is not a
// tuning problem, it is the setting's central claim being deleted by a
// modelling choice nobody made on purpose.
//
// So numbers are priced deliberately, and the shape is:
//
//     multiplier = min(CAP, effectiveBodies ^ NUMBERS_EXPONENT)
//     effectiveBodies = (sum of every engaged member's power) / strongest
//
// Read the second line first. Bodies are not counted, they are WEIGHED: a
// member counts as their share of the side's best member, so five Foundation
// disciples standing behind a Nascent Soul elder are worth about a third of
// one extra elder between them, which is what they are actually worth. The
// first line then compresses that count, so a side is its best member plus a
// sharply diminishing contribution from everybody else. Written against raw
// power the whole thing is `strongest^(1-a) * summed^a` - a geometric
// interpolation between "only the strongest of you matters" and "add yourselves
// up", with the exponent saying where between them the world sits.
//
// AND IT IS SPENT AS STRIKES, NOT AS POWER
// ----------------------------------------
// The multiplier is not added to anybody's power. It is the number of strikes
// the side gets to land in a round, and everybody who lands one lands it at
// their own undiluted weight. The distinction is the entire difference between
// a rule that holds and one that leaks: scaling power instead would let a
// hundred people each contribute a hundredth of the budget, and because damage
// is concave in advantage, a hundred small strikes beat one large one of the
// same total. That leak is worth about a realm at twenty bodies, which was
// measured before it was closed.
//
// Spent as strikes, the ceiling is exact. A side's damage in a round can never
// exceed `MAX_NUMBERS_MULTIPLIER` strikes from its best member, whatever it
// brought. Bodies past the budget still stand, still get hit, and still have to
// be cut through - so numbers buy TIME rather than force, which is what a
// crowd actually is. The fractional part of the budget is a seeded draw, so a
// side of two lands a second strike about a third of the time rather than
// always or never.
//
// A side of one is priced at exactly one strike from its own power, so a
// one-against-one melee is the two-party arithmetic unchanged.
//
// NEITHER CONSTANT IS INVENTED
// ----------------------------
// The exponent is fixed by the edge table that already exists. `EDGE_VALUES`
// has priced `numbers` at 1.35 since before this section did, and that price is
// a statement about the commonest case there is: a second body. So the exponent
// is whatever makes two equal bodies come out at exactly 1.35, and nothing else
// was free to choose.
//
// The cap is the load-bearing one and it is set below a realm on purpose. A
// realm is worth four. If numbers alone could reach four, then a big enough mob
// beats anybody one rung up, and "a realm above is categorically unfightable"
// becomes a sentence in a README that the engine contradicts. The cap is two -
// deliberately the same figure as `WITHIN_REALM_PEAK`, so that turning up in
// numbers is worth, at its absolute ceiling, exactly what climbing an entire
// realm's worth of sub-ranks is worth, and never what crossing into the realm
// above is worth.
//
// It saturates near five equal bodies. The sixth through the six-hundredth are
// witnesses. That is the intended reading and it is what stops a mob.
//
// WHICH DOES NOT MAKE ANYBODY INVINCIBLE
// --------------------------------------
// Two things keep the ceiling from becoming a floor under the strong, and both
// were already in this file:
//
//   - Within a realm numbers decide, and quickly. Two peers at one rung get
//     about a third again as many strikes as the one, and twice as much body to
//     cut through, and the one loses. That is the ordinary way anybody on this
//     ladder is killed and it does not stop being true at the top of it.
//   - Across a realm, bodies are not the answer and something brought is.
//     `MAX_EDGE_MULTIPLIER` is six, above the four a realm costs, so a side that
//     laid a formation, chose the ground and moved first can overturn a realm
//     that no number of bodies alone could. The lesson the engine teaches is
//     that you do not solve a realm with a crowd, you solve it with preparation,
//     and the crowd is what holds the ground while you do.
//
// AND COORDINATION DOES NOT CROSS A REALM
// ---------------------------------------
// One further restriction, and it is the one the setting cares about most.
// Numbers are counted against the LADDER, not against each other: a member
// standing a full major realm below the best thing facing them buys their side
// no strikes at all, however many of them turn up. They are still in the fight
// - they can still be hit, they still have to be cut through, and if everybody
// above them falls the budget comes to them - but they do not add to it.
//
// Without this the sub-rank curve leaks the realm back open. `WITHIN_REALM_PEAK`
// puts a realm's Perfection at half the next realm's Early, so six cultivators
// at the top of one realm against one at the bottom of the next is only a two-
// fold gap and a headcount walks through it. That is exactly the case the world
// says is impossible, so the count refuses to cross the boundary and the ratio
// never gets the chance.
//
// What still crosses a realm is what somebody BROUGHT. `MAX_EDGE_MULTIPLIER` is
// six against a realm's four, so one cultivator with a formation, the ground and
// the first move can overturn a realm that any number of their friends could
// not. Bodies buy time; preparation buys the realm.
//
// Two realms remains `no_contest`, which is rule 1 and is not this section's to
// revisit.
//
// WHAT SOMEBODY IS CARRYING IS NOT A SPECIAL CASE
// -----------------------------------------------
// The strongest people in this world are frequently standing on an object, and
// there is deliberately NO code here that knows that. There is no branch on who
// somebody is, no rule about institutions, and nothing anywhere that reads a
// faction tier. An object made by somebody who crossed is written down with a
// rank, `CombatantInput.artifactOrdinal` prices it as that rank, and every
// consequence anybody wants from it falls out of the same arithmetic that
// resolves two farmhands with sticks. Take the object away and its bearer
// prices out as an ordinary cultivator at their ordinal, with no residue,
// because there was never anything else there.
//
// What that produces is worth stating, since it is the whole reason the rating
// is on the ladder scale rather than on a scale of its own: a rated object is
// worth a second body of that rank, and a second body is the exact unit numbers
// are counted in above. So an object at the bearer's own realm answers roughly
// one more person, which is why the ordinary plan - two of you, arriving
// together - stops being sufficient against somebody holding one, and why the
// number it takes goes up by about one rather than by an order. None of that is
// written anywhere. It is what the arithmetic does.
// ═════════════════════════════════════════════════════════════════════════

/**
 * What a second equal body is worth, as an exponent on the body count.
 *
 * Derived, not chosen: `EDGE_VALUES.numbers` is the price this module already
 * put on having more people than the other side, so two equal bodies must come
 * out at exactly that and the exponent is whatever does it. Deriving it here
 * rather than writing 0.433 down means the two cannot drift apart later.
 */
export const NUMBERS_EXPONENT = Math.log(EDGE_VALUES.numbers) / Math.log(2);

/**
 * Hard ceiling on what turning up in numbers can ever be worth.
 *
 * Two, and the number is the whole argument. A realm is worth four. A cap at or
 * above four would mean a large enough crowd beats somebody a realm above them,
 * and the hierarchy would be a suggestion. A cap at two says a crowd is worth,
 * at most, what climbing from a realm's Early to its Perfection is worth -
 * which is `WITHIN_REALM_PEAK`, deliberately the same figure - and never what
 * crossing into the next realm is worth.
 *
 * Saturates at about five equal bodies. Everybody past the fifth is a witness.
 */
export const MAX_NUMBERS_MULTIPLIER = 2;

/**
 * Advantage at which a strike stops being an exchange and becomes a removal.
 *
 * `MAX_EDGE_MULTIPLIER` again, and for its own reason: it is the cap on
 * everything the weaker party could possibly have brought. A gap wider than
 * that is by this module's own definition one that nothing carried into the
 * encounter would have closed, so there is nothing left for a die to decide.
 * This is what lets somebody at a large advantage clear attackers off
 * themselves between exchanges instead of grinding through a health bar each,
 * and it is why a mob does not get to trade its way through an elder.
 */
export const OVERWHELMING_ADVANTAGE = MAX_EDGE_MULTIPLIER;

/**
 * How many people one use of an art lands on.
 *
 * The counts are the whole of the area mechanic and they are the same for
 * everybody. Nothing here reads a rank, a faction or a name: a bandit whose
 * wide swing reaches three reaches three, and so does a Grand Ascension
 * cultivator whose does. What separates them is the ordinary power arithmetic
 * applied once per person the art reached - which is exactly the point, because
 * against somebody far enough above them each of those becomes an overwhelming
 * removal rather than a scratch.
 *
 * `field` is unbounded on purpose. An art that lands on a PLACE does not have a
 * headcount in it; the catalog's own joke about Deity Transformation cultivators
 * being asked not to know Hollow Mountain Decree in inhabited places is only
 * funny if the answer is "everyone who was there".
 */
export const REACH_TARGETS: Readonly<Record<TechniqueReach, number>> = {
    single: 1,
    several: 3,
    field: Number.POSITIVE_INFINITY
};

/** An art with nothing recorded reaches one person, which is what it always did. */
export function reachOf(technique: Technique | null | undefined): TechniqueReach {
    return technique?.reach ?? 'single';
}

/** What `effectiveBodies` of a side buys it, capped. */
export function numbersMultiplier(effectiveBodies: number): number {
    if (!Number.isFinite(effectiveBodies) || effectiveBodies <= 1) return 1;
    return Math.min(MAX_NUMBERS_MULTIPLIER, Math.pow(effectiveBodies, NUMBERS_EXPONENT));
}

export interface SideStrength {
    /** The best member's composite total. Numbers never raise this. */
    strongest: number;
    /** Everybody added up. Reported so the discount is visible, never used raw. */
    summed: number;
    /** `summed / strongest`. Bodies weighed against the best one rather than counted. */
    effectiveBodies: number;
    /** What those bodies bought, capped at `MAX_NUMBERS_MULTIPLIER`. */
    multiplier: number;
    /** True when the cap bit, i.e. when the extra bodies were witnesses. */
    capped: boolean;
    /**
     * `strongest * multiplier`. What this side brings to bear, for comparison
     * and for narration. Resolution never uses it directly - it spends
     * `multiplier` as strikes, which is the same budget without the leak.
     */
    weight: number;
}

/**
 * Price a side from its priced members.
 *
 * Pure, and separate from the resolution so the arithmetic can be read and
 * tested on its own. Hand it only the members who are actually engaged; someone
 * categorically outclassed by everyone opposite is not a smaller contribution,
 * they are not a contribution.
 */
export function sideStrength(powers: readonly CombatantPower[]): SideStrength {
    if (powers.length === 0) {
        return { strongest: 0, summed: 0, effectiveBodies: 0, multiplier: 1, capped: false, weight: 0 };
    }

    const strongest = powers.reduce((best, p) => Math.max(best, p.total), 0);
    const summed = powers.reduce((total, p) => total + p.total, 0);
    const effectiveBodies = strongest > 0 ? summed / strongest : powers.length;
    const raw = effectiveBodies <= 1 ? 1 : Math.pow(effectiveBodies, NUMBERS_EXPONENT);
    const multiplier = Math.min(MAX_NUMBERS_MULTIPLIER, raw);
    const weight = strongest * multiplier;

    return { strongest, summed, effectiveBodies, multiplier, capped: multiplier < raw, weight };
}

/**
 * How many of a side's people actually land something this round.
 *
 * The whole of `numbersMultiplier`, spent. The integer part is guaranteed and
 * the remainder is a seeded draw, so a pair lands its second strike about a
 * third of the time - the difference between "two people hit twice as often"
 * (false, and it breaks the ladder) and "two people hit rather more often than
 * one" (true, and it is what `EDGE_VALUES.numbers` has always said).
 */
export function strikesThisRound(strength: SideStrength, available: number, rng: CultivationRNG): number {
    if (available <= 0) return 0;
    const budget = strength.multiplier;
    const whole = Math.floor(budget);
    const extra = rng.next() < budget - whole ? 1 : 0;
    return Math.max(1, Math.min(available, whole + extra));
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT A COMBATANT IS STANDING BEHIND
// ─────────────────────────────────────────────────────────────────────────

/**
 * Something a combatant is under the protection of, expressed as a
 * disqualification rather than a stat.
 *
 * The hook exists because the top of this world is not defended by being
 * strong. Each apex holds an immortal object, and none of the three is a
 * weapon: one makes its holder impossible to lie to about where anything is, one
 * fixes the ground it stands on, one settles who somebody is without appeal.
 * What they do is make the ordinary approaches stop working - and the ordinary
 * approaches are `Edge`s, which this module already itemises. So an aegis is
 * written as "these things you brought do not apply here", which is exactly the
 * shape those objects have.
 *
 * Nothing in `src/data` is wired to this yet and this module does not invent an
 * artifact catalog. It is the seam a catalog attaches to.
 */
export interface Aegis {
    id: string;
    name: string;
    /**
     * Edges that simply do not resolve against the bearer. An ambush has to be
     * somewhere, and somewhere is a thing the Datum Lamp's holder already knows.
     */
    denies?: readonly Edge[];
    /** Vectors that find nothing. Distinct from tradition, which is about the body. */
    forbids?: readonly AttackVector[];
    /**
     * Multiplier on the bearer's own power while being struck at. Appears as its
     * own itemised factor so the defence stays auditable. 1 for an object whose
     * whole effect is denial, which is all three of the current ones.
     */
    defenceMultiplier?: number;
    /** Engine-authored account of what it does and why that is not a stat. */
    note: string;
}

/**
 * A side that is being reinforced, and therefore does not have to win.
 *
 * The attacker's win condition against a house is not points, it is a clock.
 * Somebody standing in their own hall with an administration under them has
 * people a province away opening seals on their behalf from the moment the
 * first blow lands, so an assault has to finish inside a window or it has not
 * failed narrowly, it has failed.
 *
 * The engine holds the window and nothing else. What arrives, and how many
 * rounds a given hierarchy is worth, is the world layer's arithmetic - this
 * module must not know how many courts an institution has.
 */
export interface Reinforcement {
    /** Rounds this side has to still be standing after. Then it has held. */
    holdsFor: number;
    /** What is coming, for narration. The engine ends the melee, it does not stage a second one. */
    note: string;
}

// ─────────────────────────────────────────────────────────────────────────
// INPUT
// ─────────────────────────────────────────────────────────────────────────

export interface SideMember {
    combatant: CombatantInput;
    /** What this one personally brought, on top of whatever the side brought. */
    edges?: readonly Edge[];
    /** What this one is standing behind. */
    aegis?: readonly Aegis[];
}

/** A bare `CombatantInput` is a member who brought nothing of their own. */
export type SideMemberInput = CombatantInput | SideMember;

export interface SideInput {
    id: string;
    name: string;
    members: readonly SideMemberInput[];
    /** What the whole side brought. Every member carries it. */
    edges?: readonly Edge[];
    /** What this side is trying to do. Falls back to the context's. */
    intent?: ConfrontationIntent;
    /** Where this side aims, for members whose art can choose. */
    vector?: AttackVector;
    /** Help on its way. Turns the other sides' problem into a clock. */
    reinforcement?: Reinforcement;
}

export interface MeleeContext {
    rng: CultivationRNG;
    ambient: AmbientQi;
    turn: number;
    /** Default for any side that did not state its own. */
    intent: ConfrontationIntent;
    vector?: AttackVector;
}

// ─────────────────────────────────────────────────────────────────────────
// OUTPUT
// ─────────────────────────────────────────────────────────────────────────

/**
 * What became of one person. Deliberately finer than the side's outcome,
 * because a narrator needs to say which of them walked away.
 */
export type CombatantFate =
    /** On their feet when it ended. */
    | 'standing'
    /** Present, categorically outclassed by everybody opposite, never engaged. */
    | 'bystander'
    /** Broke off and got away. Wounds stand, so does the grudge. */
    | 'withdrew'
    /** Broke off carrying something that will not close. */
    | 'crippled'
    /** Taken alive. */
    | 'captured'
    /** Beaten and let go where it could be seen. */
    | 'humiliated'
    /** The body went and the person did not. Check `remnant`. */
    | 'body_destroyed'
    /** The finishing requirement was met in full. Still not a death. */
    | 'finished';

export interface MeleeCombatantOutcome {
    id: string;
    name: string;
    sideId: string;
    power: CombatantPower;
    fate: CombatantFate;
    hp: number;
    injuries: Injury[];
    killRequirement: KillRequirement;
    remnant: 'soul' | 'seam' | null;
    /**
     * True only when the finishing requirement for this person was met in full.
     * NOT a death: `survival.ts` is still the only thing that decides that.
     */
    finished: boolean;
    /** Who put them down, when somebody did. */
    felledBy: string | null;
}

export interface MeleeSideOutcome {
    id: string;
    name: string;
    strength: SideStrength;
    standing: string[];
    withdrawn: string[];
    fallen: string[];
    bystanders: string[];
    /** True when nobody on this side was still fighting at the end. */
    defeated: boolean;
}

export interface MeleeResult {
    /**
     * The losing side's worst fate, taken as a whole, on the same enum the
     * two-party path reports. `stalemate` when nobody was broken inside the
     * exchange budget, `no_contest` when the gap made it not a fight.
     */
    outcome: ConfrontationOutcome;
    winningSideId: string | null;
    sides: MeleeSideOutcome[];
    /** Every participant, in input order. */
    combatants: MeleeCombatantOutcome[];
    /**
     * Every strike. `result.weapon` on each carries what that strike did to the
     * striker's rated object, so a caller reads breakages off this list rather
     * than off a second field.
     *
     * The gap that used to be stated here is closed. A melee now re-prices a
     * combatant the moment their object goes, exactly as `resolveConfrontation`
     * does: the weapon comes off the input, `assessPower` runs again, and the
     * rest of the fight - including the second person a wide art reaches in the
     * same action - is fought at the new figure. It cost nothing to fix and it
     * costs nothing to have, because no caller in `src/` builds a melee with a
     * weapon in it yet; what it buys is that the day one does, the two paths do
     * not quietly disagree about "bring a bad weapon and you brought nothing".
     */
    exchanges: ExchangeRecord[];
    /** Final HP, keyed by combatant id. The caller writes these. */
    hp: Record<string, number>;
    injuries: Record<string, Injury[]>;
    /** True only when every member of every defeated side was finished in full. */
    finished: boolean;
    /**
     * Set to the side id when a side's reinforcement window closed with it still
     * standing. The assault did not lose narrowly - it ran out of clock, which
     * is a different and more useful thing for a narrator to say.
     */
    heldUntilReinforced: string | null;
    obligations: ObligationSeed[];
    narrationHint: string;
}

// ─────────────────────────────────────────────────────────────────────────
// RESOLUTION
// ─────────────────────────────────────────────────────────────────────────

interface Fighter {
    input: CombatantInput;
    sideIndex: number;
    power: CombatantPower;
    edges: readonly Edge[];
    aegis: readonly Aegis[];
    state: 'standing' | 'withdrawn' | 'fallen';
    everEngaged: boolean;
    felledBy: string | null;
    /** The vector actually used against them when they went down. */
    felledVector: AttackVector;
}

function normaliseMember(m: SideMemberInput): SideMember {
    return 'combatant' in m ? m : { combatant: m };
}

/** Append a factor without breaking the "factors multiply to total" identity. */
function withFactor(power: CombatantPower, source: string, factor: number, note: string): CombatantPower {
    if (factor === 1) return power;
    return {
        ...power,
        factors: [...power.factors, { source, factor, note }],
        total: power.total * factor
    };
}

/**
 * Resolve a confrontation between two or more sides.
 *
 * Many against one, many against many, and - because a side of one is priced at
 * exactly its own power - one against one, which comes out as the two-party
 * arithmetic with an initiative roll in front of it. `resolveConfrontation` is
 * untouched and remains the right call for a duel.
 *
 * The order of business is the order of the five rules, as it is upstairs. The
 * gap is read first and can end the whole thing; then rounds run, each living
 * combatant striking once, with every side's offence scaled by what its numbers
 * are actually worth; then each side's intent and each loser's tradition decide
 * what happened to them; then the social consequences are seeded.
 *
 * No branch anywhere favours anybody. The same function resolves a court's
 * seniors clearing out a bandit camp and three woken ancestors arriving on an
 * apex, and neither of them is the player.
 */
export function resolveMelee(sides: readonly SideInput[], ctx: MeleeContext): MeleeResult {
    if (sides.length < 2) {
        throw new Error(`resolveMelee needs at least two sides, got ${sides.length}`);
    }

    const powerCtx: PowerContext = { ambient: ctx.ambient };
    const fighters: Fighter[] = [];

    sides.forEach((side, sideIndex) => {
        for (const raw of side.members) {
            const member = normaliseMember(raw);
            fighters.push({
                input: member.combatant,
                sideIndex,
                power: assessPower(member.combatant, powerCtx),
                edges: [...(side.edges ?? []), ...(member.edges ?? [])],
                aegis: member.aegis ?? [],
                state: 'standing',
                everEngaged: false,
                felledBy: null,
                felledVector: 'body'
            });
        }
    });

    if (fighters.length === 0) {
        throw new Error('resolveMelee needs at least one combatant');
    }

    const hp: Record<string, number> = {};
    const injuries: Record<string, Injury[]> = {};
    for (const f of fighters) {
        hp[f.input.id] = f.input.hp;
        injuries[f.input.id] = [];
    }

    const byId = new Map(fighters.map(f => [f.input.id, f]));
    const exchanges: ExchangeRecord[] = [];

    const living = () => fighters.filter(f => f.state === 'standing');
    const enemiesOf = (f: Fighter) => living().filter(o => o.sideIndex !== f.sideIndex);

    // ── RULE 1, at the level of a person. ──
    // Somebody two major realms under everybody opposite them is not a weak
    // contributor, they are not a contributor. They cannot land anything and
    // they do not count toward what their side brings.
    const canReach = (f: Fighter, targets: readonly Fighter[]) =>
        targets.some(t => assessGap(f.power, t.power).verdict !== 'helpless');

    const sidesThatCanReach = sides
        .map((_, index) => index)
        .filter(index => fighters.some(f =>
            f.sideIndex === index && canReach(f, fighters.filter(o => o.sideIndex !== index))
        ));

    if (sidesThatCanReach.length === 0) {
        return assemble(sides, fighters, hp, injuries, exchanges, ctx, null);
    }
    if (sidesThatCanReach.length === 1) {
        // Not a fight in either direction: one side gets what it came for, at no
        // risk, in a single action, and everybody else is a decision rather than
        // an opponent.
        const winner = sidesThatCanReach[0];
        const intent = sides[winner].intent ?? ctx.intent;
        const vector = sides[winner].vector ?? ctx.vector ?? 'body';
        for (const f of fighters) {
            if (f.sideIndex === winner) continue;
            const reachable = vector !== 'soul' || soulAttacksAffect(f.power.tradition);
            if (!reachable) continue;
            f.state = 'fallen';
            f.felledVector = vector;
            f.felledBy = fighters.find(o => o.sideIndex === winner)?.input.id ?? null;
            if (intent.goal === 'kill') {
                hp[f.input.id] = 0;
            } else {
                hp[f.input.id] = Math.max(1, Math.floor(f.input.maxHp * 0.2));
                injuries[f.input.id].push(
                    createInjury({ severity: 'serious', source: 'combat', turn: ctx.turn, woundType: ordinaryWoundFor('combat', 'serious') }, ctx.rng)
                );
            }
        }
        return assemble(sides, fighters, hp, injuries, exchanges, ctx, winner);
    }

    // ── Initiative, rolled once so the order is stable across the whole melee. ──
    const order = rollInitiative(
        fighters.map(f => ({ id: f.input.id, name: f.input.name, ordinal: f.input.realmOrdinal })),
        ctx.rng
    ).map(entry => byId.get(entry.id)!);

    // ── Rounds. ──
    const roundBudget = meleeRoundBudget(sides);
    for (let round = 0; round < roundBudget; round++) {
        const activeSides = new Set(living().map(f => f.sideIndex));
        if (activeSides.size < 2) break;

        // Recomputed every round: as a side thins its budget shrinks with it,
        // and the last one standing is a side of one fighting at their own weight.
        const acting = new Set<string>();
        sides.forEach((_, index) => {
            const engaged = fighters
                .filter(f => f.sideIndex === index && f.state === 'standing' && canReach(f, enemiesOf(f)))
                .sort((a, b) =>
                    b.power.total - a.power.total ||
                    (a.input.id < b.input.id ? -1 : a.input.id > b.input.id ? 1 : 0)
                );
            // In the fight, whether or not the budget reaches them this round.
            // A bystander is somebody the gap excluded, not somebody who queued.
            for (const f of engaged) f.everEngaged = true;

            // Numbers are counted against the ladder. A body a full realm below
            // the best thing facing it buys nothing, however many of them came,
            // and a side with nobody up to the task gets exactly one strike.
            const topEnemyRealm = fighters
                .filter(f => f.sideIndex !== index && f.state === 'standing')
                .reduce((top, f) => Math.max(top, f.power.realmIndex), -1);
            const counted = engaged.filter(f => f.power.realmIndex >= topEnemyRealm);
            const pool = counted.length > 0 ? counted : engaged.slice(0, 1);

            const strength = sideStrength(pool.map(f => f.power));
            const strikes = strikesThisRound(strength, engaged.length, ctx.rng);
            // Strongest first. The budget is what the side can actually land, so
            // it goes to the people most able to land it, and everybody past it
            // is standing there being a reason the fight takes longer.
            for (const f of engaged.slice(0, strikes)) acting.add(f.input.id);
        });

        for (const striker of order) {
            if (striker.state !== 'standing') continue;
            if (!acting.has(striker.input.id)) continue;

            // ── How far this one use reaches. ──
            // The area mechanic in its entirety: one action, resolved once per
            // person the art lands on, with every strike priced by the ordinary
            // arithmetic. It deliberately does NOT touch the strike budget - a
            // side still gets the strikes its numbers bought it, and an area art
            // widens each of those rather than granting more. That asymmetry is
            // what keeps rule 1 intact: reach scales with how many ENEMIES are
            // present, never with how many friends, so twenty people a realm
            // below still land one strike a round between them however wide
            // their arts are, while one person above them can answer all twenty
            // at once.
            const reach = reachOf(striker.input.technique);
            const targets = orderTargets(striker, enemiesOf(striker), hp)
                .slice(0, REACH_TARGETS[reach]);
            if (targets.length === 0) continue;
            striker.everEngaged = true;

            const side = sides[striker.sideIndex];

            for (const target of targets) {
                if (target.state !== 'standing') continue;

                // Re-read every time, never captured. A wide art resolves once
                // per person it lands on, so an object that breaks against the
                // first of them is already gone against the second - the same
                // rule `resolveConfrontation` states as "a weapon lost on the
                // first swing of a round is already gone on the second".
                const strikePower = striker.power;

                // Aegis, read before the dice, the way tradition is. Per person,
                // because an art that lands on a place still meets each of them
                // separately: one of a crowd standing behind something is covered
                // by it and the person beside them is not.
                const denied = new Set(target.aegis.flatMap(a => a.denies ?? []));
                const edges = striker.edges.filter(e => !denied.has(e));
                const forbidden = new Set(target.aegis.flatMap(a => a.forbids ?? []));
                const defenceMultiplier = target.aegis.reduce(
                    (product, a) => product * (a.defenceMultiplier ?? 1), 1
                );
                const defendPower = target.aegis.length === 0
                    ? target.power
                    : withFactor(
                        target.power,
                        `aegis:${target.aegis.map(a => a.id).join('+')}`,
                        defenceMultiplier,
                        target.aegis.map(a => a.note).join(' ')
                    );

                let vector: AttackVector = (side.vector ?? ctx.vector ?? 'body') === 'soul'
                    && canDirectAtSoul(striker.input.technique)
                    ? 'soul'
                    : 'body';
                if (forbidden.has(vector)) vector = vector === 'soul' ? 'body' : 'soul';

                if (forbidden.has(vector)) {
                    exchanges.push({
                        index: exchanges.length,
                        attackerId: striker.input.id,
                        defenderId: target.input.id,
                        result: {
                            damage: 0, injury: null, nullified: true,
                            nullifiedReason: 'aegis_forbids_vector',
                            vector, advantage: 0, roll: 0, modifiers: [], weapon: null,
                            narrationHint:
                                `The approach does not resolve against ${target.input.name}. ` +
                                target.aegis.map(a => a.note).join(' ')
                        },
                        defenderHpAfter: hp[target.input.id]
                    });
                    continue;
                }

                const result = resolveExchange(strikePower, defendPower, target.input.maxHp, {
                    rng: ctx.rng,
                    ambient: ctx.ambient,
                    turn: ctx.turn,
                    vector,
                    attackerEdges: edges,
                    defenderEdges: target.edges
                });

                hp[target.input.id] = Math.max(0, hp[target.input.id] - result.damage);
                if (result.injury) injuries[target.input.id].push(result.injury);

                // A gap this wide is one nothing brought would have closed, so
                // there is nothing left to grind through. This is what lets
                // somebody at a large advantage take attackers off themselves
                // between exchanges, instead of a crowd trading its way home on
                // the strength of having more health bars than the elder has
                // attacks - and, met once per person by a wide art, it is the
                // whole of why fifteen breaths is enough to end a faction.
                if (!result.nullified && result.advantage >= OVERWHELMING_ADVANTAGE) {
                    hp[target.input.id] = 0;
                }

                // The object went. Take it off the person who was swinging it
                // and price them again, so the rest of the melee is fought
                // without it. Identical to the two-party path, deliberately:
                // this used to be a stated gap, and a combatant who lost a
                // blade in round one went on being priced as though they held
                // it for every round after.
                if (result.weapon?.broke) {
                    striker.input = { ...striker.input, weapon: null, artifactOrdinal: undefined };
                    striker.power = assessPower(striker.input, powerCtx);
                }

                exchanges.push({
                    index: exchanges.length,
                    attackerId: striker.input.id,
                    defenderId: target.input.id,
                    result,
                    defenderHpAfter: hp[target.input.id]
                });

                const targetIntent = sides[target.sideIndex].intent ?? ctx.intent;
                if (hp[target.input.id] <= 0) {
                    target.state = 'fallen';
                    target.felledBy = striker.input.id;
                    target.felledVector = vector;
                } else if (
                    (targetIntent.willWithdraw ?? true) &&
                    hp[target.input.id] < target.input.maxHp * WITHDRAW_HP_FRACTION
                ) {
                    target.state = 'withdrawn';
                    target.felledBy = striker.input.id;
                    target.felledVector = vector;
                }
            }

            if (new Set(living().map(f => f.sideIndex)).size < 2) break;
        }

        // ── The stall. Somebody who only had to last has lasted. ──
        // Checked at the end of a round rather than during it, so a window of
        // one means "you get one round", and an assault that finishes inside it
        // still finishes.
        const held = sides.findIndex((side, index) =>
            side.reinforcement !== undefined &&
            round + 1 >= side.reinforcement.holdsFor &&
            fighters.some(f => f.sideIndex === index && f.state === 'standing')
        );
        if (held >= 0) {
            // Everybody else has to be gone before the answer lands, so they go.
            for (const f of fighters) {
                if (f.sideIndex !== held && f.state === 'standing') f.state = 'withdrawn';
            }
            return assemble(sides, fighters, hp, injuries, exchanges, ctx, held, sides[held].id);
        }
    }

    const survivingSides = new Set(living().map(f => f.sideIndex));
    const winner = survivingSides.size === 1 ? [...survivingSides][0] : null;
    return assemble(sides, fighters, hp, injuries, exchanges, ctx, winner);
}

/**
 * Who a striker goes after.
 *
 * Anybody they are categorically below is not a target, because they cannot
 * touch them. Among the rest: the most hurt first, which is what focus fire
 * actually is - a side that has opened somebody up finishes them rather than
 * spreading the damage evenly and finishing nobody - and then the weakest,
 * because the cheapest body to remove is the one to remove.
 */
/**
 * Everybody this striker could hit, best first.
 *
 * One ordering serves both cases: a single-target art takes the head of this
 * list, and an area art takes as much of it as the art reaches. So a wide art
 * lands on the people a striker would have chosen anyway, in that order.
 */
function orderTargets(
    striker: Fighter,
    enemies: readonly Fighter[],
    hp: Record<string, number>
): Fighter[] {
    const reachable = enemies.filter(e => assessGap(striker.power, e.power).verdict !== 'helpless');
    if (reachable.length === 0) return [];

    const byId = (a: Fighter, b: Fighter) =>
        a.input.id < b.input.id ? -1 : a.input.id > b.input.id ? 1 : 0;

    // Somebody you could remove with one strike is, by this module's own rule 1,
    // not in the fight. So they do not get an action spent on them while anybody
    // who IS in it is still standing.
    //
    // Sorting on weakest-first alone made that false, and measurably so: a side
    // could put one real threat behind a wall of people who could never touch
    // the defender at all, and the defender would spend every exchange of the
    // fight deleting the wall - at advantage 2867 in the case that found this -
    // while the one person who could hurt her did so unopposed, every round,
    // taking her from full to a third and off the field. Bodies this module
    // calls irrelevant were deciding fights by standing there, which is the
    // sharpest contradiction of rule 1 available.
    //
    // This cannot win anybody anything by itself: it only ever decides which
    // enemy a striker spends an action on, never how hard the action lands.
    const dangerous = reachable.filter(
        e => assessGap(e.power, striker.power).powerRatio < OVERWHELMING_ADVANTAGE
    );

    const byThreat = (a: Fighter, b: Fighter) => b.power.total - a.power.total || byId(a, b);

    // Nothing here can hurt them: clear the field, biggest first.
    if (dangerous.length === 0) return [...reachable].sort(byThreat);

    // Otherwise focus fire on the people who count: the most hurt first, so a
    // side that has opened somebody up finishes them instead of spreading damage
    // and finishing nobody, and then the weakest, as the cheapest to remove.
    // Anybody harmless comes after all of them, for an art wide enough to reach.
    const harmless = reachable.filter(e => !dangerous.includes(e)).sort(byThreat);
    const ordered = [...dangerous].sort((a, b) => {
        const fa = a.input.maxHp > 0 ? hp[a.input.id] / a.input.maxHp : 0;
        const fb = b.input.maxHp > 0 ? hp[b.input.id] / b.input.maxHp : 0;
        return fa - fb || a.power.total - b.power.total || byId(a, b);
    });
    return [...ordered, ...harmless];
}

/** Severity order, so a side's outcome is the worst thing that happened to it. */
const OUTCOME_SEVERITY: Readonly<Record<ConfrontationOutcome, number>> = {
    no_contest: 0,
    stalemate: 1,
    withdrawal: 2,
    humiliation: 3,
    // Above being taken alive and below being crippled. Somebody carried off
    // has had something done to them; somebody who knelt DID something, in
    // front of whoever was there, and the difference is what they have to live
    // with afterwards. It is still short of a wound that never closes.
    submission: 4,
    capture: 5,
    crippled: 6,
    body_destroyed: 7,
    lethal: 8
};

const FATE_FOR_OUTCOME: Readonly<Record<string, CombatantFate>> = {
    lethal: 'finished',
    body_destroyed: 'body_destroyed',
    capture: 'captured',
    humiliation: 'humiliated',
    withdrawal: 'withdrew'
};

function assemble(
    sides: readonly SideInput[],
    fighters: readonly Fighter[],
    hp: Record<string, number>,
    injuries: Record<string, Injury[]>,
    exchanges: ExchangeRecord[],
    ctx: MeleeContext,
    winner: number | null,
    heldUntilReinforced: string | null = null
): MeleeResult {
    const combatants: MeleeCombatantOutcome[] = fighters.map(f => {
        const requirement = f.power.kill;
        let fate: CombatantFate;
        let remnant: 'soul' | 'seam' | null = null;

        if (f.state === 'standing') {
            fate = f.everEngaged ? 'standing' : 'bystander';
        } else if (f.state === 'withdrawn') {
            fate = injuries[f.input.id].some(i => i.severity === 'crippling') ? 'crippled' : 'withdrew';
        } else {
            const felledBy = f.felledBy !== null
                ? fighters.find(o => o.input.id === f.felledBy)
                : undefined;
            const intent = felledBy !== undefined
                ? (sides[felledBy.sideIndex].intent ?? ctx.intent)
                : ctx.intent;
            const outcome = finishOutcome(intent.goal, f.felledVector, requirement);
            fate = FATE_FOR_OUTCOME[outcome] ?? 'withdrew';
            if (fate === 'body_destroyed') remnant = requirement.remnant;
            if (fate === 'withdrew' && injuries[f.input.id].some(i => i.severity === 'crippling')) {
                fate = 'crippled';
            }
        }

        return {
            id: f.input.id,
            name: f.input.name,
            sideId: sides[f.sideIndex].id,
            power: f.power,
            fate,
            hp: hp[f.input.id],
            injuries: injuries[f.input.id],
            killRequirement: requirement,
            remnant,
            finished: fate === 'finished',
            felledBy: f.felledBy
        };
    });

    const sideOutcomes: MeleeSideOutcome[] = sides.map((side, index) => {
        const mine = fighters.filter(f => f.sideIndex === index);
        const engaged = mine.filter(f => f.state === 'standing');
        const outcomeOf = (f: Fighter) => combatants.find(c => c.id === f.input.id)!;
        return {
            id: side.id,
            name: side.name,
            strength: sideStrength(mine.map(f => f.power)),
            standing: engaged.filter(f => outcomeOf(f).fate === 'standing').map(f => f.input.id),
            withdrawn: mine.filter(f => f.state === 'withdrawn').map(f => f.input.id),
            fallen: mine.filter(f => f.state === 'fallen').map(f => f.input.id),
            bystanders: engaged.filter(f => outcomeOf(f).fate === 'bystander').map(f => f.input.id),
            defeated: winner !== null && index !== winner
        };
    });

    // ── The side outcome is the worst thing that happened to the losers. ──
    const losers = combatants.filter(c => {
        const side = sideOutcomes.find(s => s.id === c.sideId)!;
        return side.defeated;
    });

    let outcome: ConfrontationOutcome;
    if (winner === null) {
        outcome = exchanges.length === 0 ? 'no_contest' : 'stalemate';
    } else if (exchanges.length === 0 && losers.every(c => c.fate === 'bystander')) {
        outcome = 'no_contest';
    } else {
        outcome = losers.reduce<ConfrontationOutcome>((worst, c) => {
            const candidate = OUTCOME_FOR_FATE[c.fate];
            return OUTCOME_SEVERITY[candidate] > OUTCOME_SEVERITY[worst] ? candidate : worst;
        }, 'stalemate');
    }

    const obligations: ObligationSeed[] = [];
    for (const c of combatants) {
        if (c.felledBy === null) continue;
        obligations.push(
            ...seedObligations(OUTCOME_FOR_FATE[c.fate], c.felledBy, c.id, c.name, c.injuries)
        );
    }

    const finished = winner !== null && losers.length > 0 && losers.every(c => c.finished);

    return {
        outcome,
        winningSideId: winner === null ? null : sides[winner].id,
        sides: sideOutcomes,
        combatants,
        exchanges,
        hp,
        injuries,
        finished,
        heldUntilReinforced,
        obligations,
        narrationHint:
            (heldUntilReinforced !== null
                ? `${sides[winner!].name} did not have to win, only last, and lasted. ` +
                  `${sides[winner!].reinforcement?.note ?? 'The answer is on its way.'} `
                : '') +
            describeMelee(sideOutcomes, combatants, outcome, winner === null ? null : sides[winner])
    };
}

const OUTCOME_FOR_FATE: Readonly<Record<CombatantFate, ConfrontationOutcome>> = {
    standing: 'stalemate',
    bystander: 'no_contest',
    withdrew: 'withdrawal',
    crippled: 'crippled',
    captured: 'capture',
    humiliated: 'humiliation',
    body_destroyed: 'body_destroyed',
    finished: 'lethal'
};

function describeMelee(
    sides: readonly MeleeSideOutcome[],
    combatants: readonly MeleeCombatantOutcome[],
    outcome: ConfrontationOutcome,
    winner: SideInput | null
): string {
    const fallen = combatants.filter(c => c.fate === 'finished' || c.fate === 'body_destroyed');
    const gone = combatants.filter(c => c.fate === 'withdrew' || c.fate === 'crippled');
    const bystanders = combatants.filter(c => c.fate === 'bystander');

    const parts: string[] = [];
    if (winner === null) {
        parts.push(
            outcome === 'no_contest'
                ? 'Nobody present could reach anybody else. Nothing was resolved because nothing was contested.'
                : 'Neither side broke. Everybody who came is still standing and nothing is settled.'
        );
    } else {
        const held = sides.find(s => s.id === winner.id)!;
        parts.push(
            `${winner.name} held the field with ${held.standing.length} standing` +
            (held.strength.capped
                ? `, and brought bodies past the point where more bodies were worth anything.`
                : `, weighing ${held.strength.effectiveBodies.toFixed(2)} bodies against their best.`)
        );
    }
    if (fallen.length > 0) {
        parts.push(`Down: ${fallen.map(c => `${c.name} (${c.fate})`).join(', ')}.`);
    }
    if (gone.length > 0) {
        parts.push(`Broke off: ${gone.map(c => c.name).join(', ')}.`);
    }
    if (bystanders.length > 0) {
        parts.push(
            `${bystanders.map(c => c.name).join(', ')} never entered it. ` +
            'Two major realms is not a small disadvantage, it is not being in the fight.'
        );
    }
    return parts.join(' ');
}
