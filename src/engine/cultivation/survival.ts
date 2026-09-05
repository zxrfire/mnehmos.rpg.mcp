/**
 * The death engine.
 */

import {
    BLEED_OUT_TURNS,
    CRIPPLING_UNTREATED_INJURIES,
    SATIETY_COST_PER_ACTION,
    SATIETY_MAX,
    stagnationYearsForOrdinal,
    STARVATION_TURNS,
    SUICIDAL_HP_FRACTION,
    type Cultivator,
    type DeathCause
} from '../../schema/cultivation.js';
import {
    effectiveLifespanYears,
    rankName,
    realmForOrdinal,
    type RealmKey
} from './realms.js';
import { lifespanWithPhysique, physiqueOrNull } from './physiques.js';
import { bleedingInjuryCount } from './injuries.js';
import type { Injury } from '../../schema/cultivation.js';
import { hasBody, isGoingConcern, isTerminal } from './existence.js';

// SATIETY
// Food is a logistics problem, not a stat. At SATIETY_COST_PER_ACTION = 2 out
// of SATIETY_MAX = 100, a full belly buys exactly 50 turn-consuming actions,
// and five turns past empty you are dead. A decade of seclusion is therefore
// impossible without either provisions or a grain-abstinence pill - which is
// the correct answer, and the reason that pill effect exists in the schema.

/**
 * The point at which somebody should be told they are hungry. It lives here
 * rather than in a narrator because two paths need it and they disagreed.
 * Measured by playing: fourteen straight years of work took a cultivator from
 * full health to half, satiety to this line, and the purse past a thousand
 * stones, and never once mentioned food.
 */
export const LOW_SATIETY = Math.round(SATIETY_MAX * 0.2);

/** Turn-consuming actions a full belly covers. */
export const ACTIONS_PER_FULL_SATIETY = Math.floor(SATIETY_MAX / SATIETY_COST_PER_ACTION);

export interface SatietyState {
    satiety: number;
    starvationTurns: number;
}

// HUNGER TAPERS, AND THEN STOPS
//
// A mortal eats every day. A cultivator eats less and less the further up they
// get, because less and less of what keeps them going is food - and at Deity
// Transformation it stops entirely. That realm is where a cultivator stops
// drawing qi in and starts displacing it, and a body that no longer takes
// anything from the world does not take meals from it either.
//
// This is not a convenience. Below it, food is a real logistics problem and the
// thing that quietly ends most early runs: a player who seals themselves in a
// cave for a decade with three months of rations starves in the dark, and that
// is a correct outcome. Above it, a forty-year seclusion is a decision about
// forty years rather than a shopping trip, and the game becomes about the
// ladder instead of the pantry.

/**
 * What one day's hunger costs at this realm, as a fraction of a mortal's.
 */
export const SATIETY_BURN_BY_REALM: Readonly<Record<RealmKey, number>> = {
    qi_condensation: 1,
    // A full belly lasts a Foundation cultivator something over three years.
    // They still eat, and they eat for the ordinary reasons - but starving is
    // no longer something that happens to somebody who simply lost track of the
    // time. It takes years of finding nothing at all, which is why it is a rare
    // and specific way to die from here up rather than the default one.
    foundation_establishment: 1 / 24,
    core_formation: 1 / 120,
    nascent_soul: 1 / 600,
    deity_transformation: 0,
    void_refinement: 0,
    body_integration: 0,
    grand_ascension: 0,
    tribulation_transcendence: 0,
    immortal: 0
};

/**
 * The wound that takes the meals back.
 */
const FAILED_TRANSFORMATION = 'failed-transformation';

function transformationIsPartial(injuries: readonly Injury[] | undefined): boolean {
    if (!injuries) return false;
    return injuries.some(i => !i.treated && i.woundType === FAILED_TRANSFORMATION);
}

/**
 * The multiplier for this rung.
 */
export function satietyBurnMultiplier(
    realmOrdinal: number,
    injuries?: readonly Injury[]
): number {
    const base = SATIETY_BURN_BY_REALM[realmForOrdinal(realmOrdinal).key];
    // Only ever adds a cost, and only to somebody standing where the ability
    // would otherwise have been granted. A wound cannot make anybody hungrier
    // than the realm below them already is.
    if (base === 0 && transformationIsPartial(injuries)) {
        return SATIETY_BURN_BY_REALM.nascent_soul;
    }
    return base;
}

/** Whether this cultivator still has to eat at all. */
export function stillNeedsToEat(realmOrdinal: number, injuries?: readonly Injury[]): boolean {
    return satietyBurnMultiplier(realmOrdinal, injuries) > 0;
}

/**
 * Burn satiety for `actions` turn-consuming actions.
 */
export function burnSatiety(
    state: SatietyState,
    actions = 1,
    realmOrdinal = 0,
    /** See `satietyBurnMultiplier`. Omitting it is the old behaviour exactly. */
    injuries?: readonly Injury[]
): SatietyState {
    const count = Math.max(0, Math.floor(actions));
    if (count === 0) return { ...state };

    const multiplier = satietyBurnMultiplier(realmOrdinal, injuries);
    // Nothing is burned and nothing starves. Not "very slowly" - not at all.
    if (multiplier <= 0) return { satiety: clampSatiety(state.satiety), starvationTurns: 0 };

    let satiety = clampSatiety(state.satiety);
    let starvationTurns = Math.max(0, Math.floor(state.starvationTurns));

    // Actions that still have food to burn. Whole actions only - a half-fed
    // action does not exist.
    const perAction = SATIETY_COST_PER_ACTION * multiplier;
    const fed = Math.min(count, Math.floor(satiety / perAction));
    if (fed > 0) {
        satiety = clampSatiety(satiety - fed * perAction);
        starvationTurns = 0;
    }

    const starved = count - fed;
    if (starved > 0) {
        satiety = 0;
        starvationTurns += starved;
    }

    return { satiety, starvationTurns };
}

/** Eat. Restores to full and clears the starvation counter. */
export function eat(state: SatietyState, restore: number = SATIETY_MAX): SatietyState {
    return {
        satiety: clampSatiety(state.satiety + Math.max(0, restore)),
        starvationTurns: 0
    };
}

/**
 * Turns of starvation still survivable. Zero means the next one is fatal.
 */
export function turnsUntilStarvation(state: SatietyState, realmOrdinal = 0): number {
    const multiplier = satietyBurnMultiplier(realmOrdinal);
    if (multiplier <= 0) return Infinity;
    const fed = Math.floor(clampSatiety(state.satiety) / (SATIETY_COST_PER_ACTION * multiplier));
    const starvedSoFar = Math.max(0, Math.floor(state.starvationTurns));
    return fed + Math.max(0, STARVATION_TURNS - starvedSoFar);
}

function clampSatiety(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(SATIETY_MAX, Math.floor(n)));
}

// PRICING A STRETCH BEFORE ENTERING IT
//
// The satiety clock above answers "what happened", one day at a time. This
// answers "what would happen", before a day of it is spent, and it exists
// because those were not the same question and only the first one had code.
//
// Found by playing: a cultivator with an empty purse and an empty pack typed
// "I enter seclusion for ten years", and the command was accepted. What the
// skip then does was measured rather than assumed, and it has two branches
// that look identical from the player's chair and are not:
//
//   satiety > 0, no rations   the skip runs to the day the belly empties,
//                             stops with `starvation_begun`, and does NOT
//                             kill. Ten years were asked for and fifty days
//                             were spent. Nothing warned anybody first.
//   satiety = 0, no rations   `starvationAnnounced` is seeded true - somebody
//                             already starving has been told once - so there
//                             is no interrupt at all and they are dead on day
//                             STARVATION_TURNS, whatever duration was asked
//                             for.
//
// The second is reached from the first in one more command, which is exactly
// how it was reached in play: ejected at day 30 with an empty belly, and the
// obvious response - sit back down - is now unwarned and lethal. Every other
// wall in this engine is put up in FRONT of the player. A breakthrough with
// insufficient progress is refused before it is attempted and names the
// shortfall to the qi-unit. Hunger had all the same numbers available and
// spent them on an after-action report.
//
// So this is deliberately NOT a rescue. It does not shorten the seclusion, it
// does not feed anybody, and it does not cap what may be asked for. Dying of
// hunger in a sealed cave stays a real and reachable end. What it does is make
// the arithmetic available BEFORE the door shuts, so a caller can refuse in
// the same voice the barrier uses, naming what is short and by how much.
//
// Every figure here is derived from the same constants `consumeFood` in
// time-skip.ts burns - SATIETY_MAX, SATIETY_COST_PER_ACTION and the realm's
// burn multiplier - rather than restated, so a projection and the simulation
// that follows it cannot disagree. `provisioning.test.ts` checks every
// projection against a real `simulateTimeSkip` run for that reason.

/** What one day of this stretch costs the belly. Zero above Nascent Soul. */
function satietyPerDay(realmOrdinal: number): number {
    return SATIETY_COST_PER_ACTION * satietyBurnMultiplier(realmOrdinal);
}

/**
 * Days one full ration covers at this rung.
 */
export function daysPerRation(realmOrdinal: number): number {
    const perDay = satietyPerDay(realmOrdinal);
    return perDay > 0 ? Math.floor(SATIETY_MAX / perDay) : Infinity;
}

/** Days the belly alone covers from `satiety`, before any ration is opened. */
export function daysOfBelly(satiety: number, realmOrdinal: number): number {
    const perDay = satietyPerDay(realmOrdinal);
    return perDay > 0 ? Math.floor(clampSatiety(satiety) / perDay) : Infinity;
}

/**
 * Rations that must be in the pack for `days` to be fed end to end.
 */
export function rationsToCover(
    days: number,
    realmOrdinal: number,
    satiety: number = SATIETY_MAX
): number {
    const wanted = Number.isFinite(days) ? Math.max(0, Math.floor(days)) : 0;
    const perRation = daysPerRation(realmOrdinal);
    if (!Number.isFinite(perRation) || wanted === 0) return 0;
    const shortfall = Math.max(0, wanted - daysOfBelly(satiety, realmOrdinal));
    return Math.ceil(shortfall / perRation);
}

export interface ProvisioningInput {
    /** Days the stretch is being asked to run for. */
    days: number;
    realmOrdinal: number;
    satiety: number;
    /** Rations in the pack, or already bought at the door. */
    rations: number;
    /** Starvation already accumulated. Somebody entering hungry has less room. */
    starvationTurns?: number;
    /** On grain abstinence (辟穀), and therefore eating nothing at all. */
    grainAbstinence?: boolean;
}

/**
 * What the time skip will actually do with this request.
 */
export type ProvisioningOutcome = 'fed' | 'ejected' | 'fatal';

export interface ProvisioningAssessment {
    /** Days asked for. */
    days: number;
    /** Days the belly covers unaided. */
    bellyCovers: number;
    /** Days one ration covers at this rung. `Infinity` where hunger has stopped. */
    daysPerRation: number;
    /** Rations that would have to be carried for the whole stretch. */
    rationsNeeded: number;
    /** Rations actually carried. */
    rationsHeld: number;
    /** Rations still missing. Zero when the stretch is fed. */
    rationsShort: number;
    /** Days of the stretch that belly and pack together cover. */
    coveredDays: number;
    /** Days of the stretch with nothing whatsoever to eat. */
    uncoveredDays: number;
    /** Day offset the last of the food runs out on. `null` when it never does. */
    emptyOnDay: number | null;
    /**
     * Day offset starvation kills. `null` unless the outcome is `fatal` - an
     * ejected cultivator never reaches it, because the skip stops first.
     */
    fatalOnDay: number | null;
    /** Days asked for that will not be spent, because the skip stops early. */
    wastedDays: number;
    /** The whole stretch is fed. Shorthand for `outcome === 'fed'`. */
    sufficient: boolean;
    /** This request kills. Shorthand for `outcome === 'fatal'`. */
    fatal: boolean;
    outcome: ProvisioningOutcome;
    /**
     * One sentence naming the shortfall in the world's voice, or `null` when
     * there is nothing to say. Written for a player, not for a log.
     */
    reason: string | null;
}

/**
 * Price a stretch of days against what is in the belly and the pack.
 */
export function assessProvisioning(input: ProvisioningInput): ProvisioningAssessment {
    const days = Number.isFinite(input.days) ? Math.max(0, Math.floor(input.days)) : 0;
    const rationsHeld = Number.isFinite(input.rations) ? Math.max(0, Math.floor(input.rations)) : 0;
    const starvedAlready = Math.max(0, Math.floor(input.starvationTurns ?? 0));
    const perRation = daysPerRation(input.realmOrdinal);

    // Nothing to price. Somebody who does not eat cannot be short of food, and
    // the honest answer is that the pantry is not what stands between them and
    // the far end of a forty-year seclusion.
    if (input.grainAbstinence === true || !Number.isFinite(perRation)) {
        return {
            days,
            bellyCovers: Infinity,
            daysPerRation: Infinity,
            rationsNeeded: 0,
            rationsHeld,
            rationsShort: 0,
            coveredDays: days,
            uncoveredDays: 0,
            emptyOnDay: null,
            fatalOnDay: null,
            wastedDays: 0,
            sufficient: true,
            fatal: false,
            outcome: 'fed',
            reason: null
        };
    }

    const bellyCovers = daysOfBelly(input.satiety, input.realmOrdinal);
    const rationsNeeded = rationsToCover(days, input.realmOrdinal, input.satiety);
    const coveredDays = Math.min(days, bellyCovers + rationsHeld * perRation);
    const uncoveredDays = Math.max(0, days - coveredDays);

    // Death lands ON the threshold, exactly as `evaluateDeathConditions` reads
    // it: the STARVATION_TURNS'th consecutive starving day, counting whatever
    // was already on the counter when they sat down.
    const daysUntilFatal = Math.max(0, STARVATION_TURNS - starvedAlready);

    // The one condition that decides between walking out and not walking out,
    // and it is the entry state rather than the shortfall. This mirrors how
    // `simulateTimeSkip` seeds `starvationAnnounced`: with a belly or a pack
    // there is still an interrupt to spend, and it stops the skip before the
    // starvation clock can finish. With neither, there is nothing left to fire.
    const warningLeft = bellyCovers > 0 || rationsHeld > 0;

    const outcome: ProvisioningOutcome =
        uncoveredDays === 0 ? 'fed' : warningLeft ? 'ejected' : 'fatal';

    return {
        days,
        bellyCovers,
        daysPerRation: perRation,
        rationsNeeded,
        rationsHeld,
        rationsShort: Math.max(0, rationsNeeded - rationsHeld),
        coveredDays,
        uncoveredDays,
        emptyOnDay: outcome === 'fed' ? null : coveredDays,
        fatalOnDay: outcome === 'fatal' ? daysUntilFatal : null,
        wastedDays: outcome === 'ejected' ? days - coveredDays : 0,
        sufficient: outcome === 'fed',
        fatal: outcome === 'fatal',
        outcome,
        reason: describeProvisioning({
            days,
            coveredDays,
            rationsNeeded,
            rationsHeld,
            perRation,
            daysUntilFatal,
            outcome
        })
    };
}

function describeProvisioning(a: {
    days: number;
    coveredDays: number;
    rationsNeeded: number;
    rationsHeld: number;
    perRation: number;
    daysUntilFatal: number;
    outcome: ProvisioningOutcome;
}): string | null {
    if (a.outcome === 'fed') return null;

    const short = Math.max(0, a.rationsNeeded - a.rationsHeld);
    const pack = a.rationsHeld === 0
        ? 'The pack is empty'
        : `The pack holds ${a.rationsHeld} ration${a.rationsHeld === 1 ? '' : 's'}`;
    const need =
        `${a.days} days needs ${a.rationsNeeded} ration${a.rationsNeeded === 1 ? '' : 's'}` +
        ` at ${a.perRation} days each; ${short} short.`;

    // The sentence a player has to be able to act on: what runs out, when, and
    // what happens after. Phrased the way the barrier phrases a refusal - the
    // measurement first, no encouragement attached to it, and no suggestion
    // that the engine will do anything about it.
    if (a.outcome === 'ejected') {
        return `${pack}. ${need} The food runs out on day ${a.coveredDays}, ` +
            'and a cave nobody can stay in is a cave nobody sat in.';
    }

    return `${pack}. ${need} There is nothing to eat today and ` +
        `${a.daysUntilFatal} days of that is fatal. A cave does not deliver.`;
}

// HOW LONG THE CHANNELS HAVE BEEN OPEN
//
// This block was the bleed-out clock: a persisted counter, a pure
// advance-or-reset function, a "how long have I got" helper, and one clause in
// the death gate that ended the run at BLEED_OUT_TURNS. The clause is gone
// (see the module header and `evaluateDeathConditions`) because a torn channel
// is a torn muscle and does not kill anybody.
//
// WHAT IS LEFT IS THE MEASUREMENT, AND IT IS WORTH KEEPING. How long somebody
// has been carrying open channels is a true fact about them, it is what a
// player sees in place of the countdown that used to be here, and it is the
// mechanism any wound that genuinely haemorrhages would use if one is ever
// written. It resets on treatment exactly as it always did, so what it reports
// is the state you are in now rather than the damage of a lifetime.
//
// The names still say "bleed", and they are kept that way on purpose: renaming
// four exported symbols across a dozen importers in a shared tree sweeps up
// other people's unfinished work (AGENTS.md, "rename by re-export, never by
// rewriting importers"). What they MEAN is documented here, and nothing in
// this file kills anybody with them.
//
// The `hasBody(existence)` gate that used to guard this is unchanged and still
// guards the flesh arithmetic around it: a soul persisting without a body has
// no channels to tear.

export interface BleedState {
    /** Open channel wounds the body is currently carrying. */
    untreatedInjuries: number;
    /** Consecutive turns spent at or above CRIPPLING_UNTREATED_INJURIES. */
    bleedingTurns: number;
}

/**
 * Whether this many open wounds is the state in which a body stops coping -
 * it no longer mends itself and everything it does costs more.
 *
 * NOT a death predicate, and it was one. See the banner above.
 */
export function isBleedingOut(untreatedInjuries: number): boolean {
    return untreatedInjuries >= CRIPPLING_UNTREATED_INJURIES;
}

/**
 * Advance the open-channel counter for `turns` turns.
 */
export function bleedOut(state: BleedState, turns = 1): BleedState {
    const untreatedInjuries = Math.max(0, Math.floor(state.untreatedInjuries));
    const count = Math.max(0, Math.floor(turns));
    if (count === 0) return { untreatedInjuries, bleedingTurns: Math.max(0, Math.floor(state.bleedingTurns)) };

    if (!isBleedingOut(untreatedInjuries)) return { untreatedInjuries, bleedingTurns: 0 };

    return {
        untreatedInjuries,
        bleedingTurns: Math.max(0, Math.floor(state.bleedingTurns)) + count
    };
}

/**
 * Turns before the neglect is total. NOBODY DIES AT ZERO - it means the channels
 * have been open as long as they can be. Callers that used to schedule a death
 * deadline on this must not; the time-skip reports the count and the cost instead.
 */
export function turnsUntilBleedOut(state: BleedState): number {
    if (!isBleedingOut(Math.max(0, Math.floor(state.untreatedInjuries)))) return Infinity;
    const bled = Math.max(0, Math.floor(state.bleedingTurns));
    return Math.max(0, BLEED_OUT_TURNS - bled);
}

/** Read the bleed state straight off a cultivator's own wound list. */
export function bleedStateOf(
    cultivator: Pick<Cultivator, 'injuries' | 'bleedingTurns'>
): BleedState {
    return {
        // Open wounds only. A permanent wound is untreated for life by
        // definition and is not a bleed - see `bleedingInjuryCount`.
        untreatedInjuries: bleedingInjuryCount(cultivator.injuries),
        bleedingTurns: cultivator.bleedingTurns
    };
}

// AGING

/**
 * The years THIS body actually gets, rung and all.
 */
export function lifespanCeilingFor(
    cultivator: Pick<Cultivator, 'realmOrdinal'> &
        Partial<Pick<Cultivator, 'immortalStatus' | 'physique'>>
): number {
    return lifespanWithPhysique(
        effectiveLifespanYears(cultivator.realmOrdinal, cultivator.immortalStatus ?? 'none'),
        physiqueOrNull(cultivator.physique)
    );
}

/** Years of lifespan remaining at the current realm. Negative means overdue. */
export function lifespanRemaining(
    cultivator: Pick<Cultivator, 'realmOrdinal' | 'age'> &
        Partial<Pick<Cultivator, 'immortalStatus' | 'physique'>>
): number {
    return lifespanCeilingFor(cultivator) - cultivator.age;
}

/**
 * Years of stagnation remaining before death by aging.
 */
export function stagnationRemaining(
    cultivator: Pick<Cultivator, 'yearsAtCurrentRealm' | 'realmOrdinal'>
): number {
    return stagnationYearsForOrdinal(cultivator.realmOrdinal) - cultivator.yearsAtCurrentRealm;
}

// SUICIDAL CHOICES
// The engine will not refuse an obviously fatal choice. It will make it fatal.

export interface SuicideAssessment {
    suicidal: boolean;
    reasons: string[];
}

/**
 * Whether entering combat right now is an obviously fatal choice: below
 * SUICIDAL_HP_FRACTION of max HP.
 */
export function assessSuicidalCombat(
    cultivator: Pick<Cultivator, 'hp' | 'maxHp' | 'injuries'>
): SuicideAssessment {
    const reasons: string[] = [];
    const hpFraction = cultivator.maxHp > 0 ? cultivator.hp / cultivator.maxHp : 0;
    if (hpFraction < SUICIDAL_HP_FRACTION) {
        reasons.push(
            `HP at ${(hpFraction * 100).toFixed(0)}% of maximum, below the ${(SUICIDAL_HP_FRACTION * 100).toFixed(0)}% threshold`
        );
    }
    return { suicidal: reasons.length > 0, reasons };
}

// THE DEATH CHECK

export interface DeathContext {
    /**
     * The cultivator is entering or continuing combat right now. Required for the
     * suicidal-HP cause and for the IMMEDIATE untreated-injury cause, both of which
     * are about the choice rather than the state.
     */
    forcingCombat?: boolean;

    /**
     * What emptied the HP bar, when the caller knows and it was not violence.
     */
    hpDepletedBy?: DeathCause;
}

/**
 * The single death gate.
 */
export function evaluateDeathConditions(
    cultivator: Pick<
        Cultivator,
        'hp' | 'maxHp' | 'satiety' | 'starvationTurns' | 'age' | 'realmOrdinal' |
        'yearsAtCurrentRealm' | 'injuries' | 'alive'
    > & Partial<Pick<Cultivator,
        'existenceState' | 'immortalStatus' | 'bleedingTurns' | 'physique'>>,
    ctx: DeathContext = {}
): DeathCause | null {
    const existence = cultivator.existenceState ?? 'alive';
    const status = cultivator.immortalStatus ?? 'none';

    // Already ended stays ended. A resolved identity is immutable.
    if (isTerminal(existence) || !isGoingConcern(existence)) return null;
    if (!cultivator.alive) return null;

    // The body's own arithmetic - blood, hunger, the flesh keeping its mortal
    // schedule - only applies to someone who has a body. A soul persisting
    // without one does not starve and cannot be stabbed; it is killed by other
    // things, resolved elsewhere.
    if (hasBody(existence)) {
        // `combat_defeat` is the DEFAULT for an empty bar, not the meaning of
        // one. See `hpDepletedBy`: a caller that watched the last point go
        // says what took it, and only that caller can know.
        if (cultivator.hp <= 0) return ctx.hpDepletedBy ?? 'combat_defeat';

        // Starvation cannot kill somebody who has stopped eating. The counter
        // is not reset here on purpose - `burnSatiety` clears it the moment the
        // realm is reached, and a stale value should never resurrect the cause.
        if (
            stillNeedsToEat(cultivator.realmOrdinal, cultivator.injuries) &&
            cultivator.starvationTurns >= STARVATION_TURNS
        ) {
            return 'starvation';
        }

        // WHERE THE TWO UNTREATED-INJURY DEATHS USED TO BE
        //
        // Two clauses stood here and both are gone. One killed a cultivator who
        // entered a fight carrying CRIPPLING_UNTREATED_INJURIES open channels;
        // the other killed anybody who simply stood still with them for
        // BLEED_OUT_TURNS. Together they were the commonest death in the game.
        //
        // Design owner: "torn meridians should not kill, they don't make you
        // bleed out. it should be the same as a torn muscle irl. very VERY
        // annoying, but you don't die. but you probably lose combat
        // effectiveness of some sort or maybe cultivation speed (but not
        // comprehension)."
        //
        // So a channel wound is now an impairment and never a cause, and the
        // impairment is real rather than nominal: it takes the cultivation rate
        // (`computeCultivationRate`), the condition line and the damage a blow
        // actually lands (`assessPower` and `resolveExchange` in combat.ts), and
        // it stops the body mending itself at all (`mendingBlocked` in
        // time-skip.ts). What it does not touch is comprehension - see the note
        // in injuries.ts. `docs/world/climbing/injuries.md` is the spec.
        //
        // What did NOT change, and must not: forcing a fight while barely able
        // to stand is still an obviously fatal choice, because that one is about
        // the HP bar rather than about a wound. Losing the fight that follows
        // still kills you the ordinary way, and a badly wounded cultivator now
        // loses it far more often.
        if (ctx.forcingCombat) {
            const hpFraction = cultivator.maxHp > 0 ? cultivator.hp / cultivator.maxHp : 0;
            if (hpFraction < SUICIDAL_HP_FRACTION) return 'obviously_fatal_choice';
        }
    }

    // A True Immortal is through the Lid and out of the world's arithmetic
    // entirely. A False Immortal is emphatically NOT immortal - they get a vast
    // finite span, and `effectiveLifespanYears` is where that lives.
    if (status !== 'true_immortal' && cultivator.age >= lifespanCeilingFor(cultivator)) {
        return 'lifespan_exhausted';
    }

    // Settling is what happens to a cultivator who stopped climbing. Neither
    // kind of immortal is still climbing, and neither is settling: one is gone
    // and the other is permanently barred, counting down a lifespan instead.
    if (
        status === 'none' &&
        cultivator.yearsAtCurrentRealm >= stagnationYearsForOrdinal(cultivator.realmOrdinal)
    ) {
        return 'stagnation_aging';
    }

    return null;
}

/**
 * Engine-authored factual account of a death. The narrator renders it; it does
 * not get to soften it, and it does not get to invent one.
 */
export function describeDeath(
    cause: DeathCause,
    cultivator: Pick<Cultivator, 'name' | 'realmOrdinal' | 'age'> &
        Partial<Pick<Cultivator, 'immortalStatus' | 'physique'>>
): string {
    const who = `${cultivator.name}, ${rankName(cultivator.realmOrdinal)}, age ${Math.floor(cultivator.age)}`;
    switch (cause) {
        case 'combat_defeat':
            return `${who}: killed in combat.`;
        case 'obviously_fatal_choice':
            return `${who}: forced a fight while barely able to stand, and did not survive it.`;
        case 'lifespan_exhausted':
            return `${who}: lifespan exhausted at the limit of `
                + `${Math.round(lifespanCeilingFor(cultivator))} years. Died of old age.`;
        case 'stagnation_aging':
            return `${who}: spent ${Math.round(stagnationYearsForOrdinal(cultivator.realmOrdinal))} years without advancing a single rank. Died of old age at a bottleneck never crossed.`;
        case 'untreated_injuries':
            // RETIRED. Nothing produces this cause any more - a torn channel is
            // a torn muscle. The branch stays so that a run ledger written
            // before the ruling still renders, which in a permadeath game is
            // the only surviving account of that life. Deliberately silent on
            // which of the two old routes it was: the cause reaches here
            // without a context, and inventing "fought" for somebody who died
            // in a cave would be the engine narrating what it does not know.
            return `${who}: carried ${CRIPPLING_UNTREATED_INJURIES} or more untreated meridian injuries. The meridians gave out.`;
        case 'starvation':
            return `${who}: starved to death after ${STARVATION_TURNS} turns without food.`;
        case 'failed_breakthrough':
            return `${who}: died attempting a breakthrough. The meridians ruptured.`;
        case 'qi_deviation':
            return `${who}: died of qi deviation.`;
        case 'heavenly_tribulation':
            return `${who}: destroyed by heavenly tribulation.`;
    }
}
