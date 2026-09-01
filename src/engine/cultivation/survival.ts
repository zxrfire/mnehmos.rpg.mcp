/**
 * The death engine.
 *
 * This is the ONLY place in the cultivation layer that decides a cultivator is
 * dead. Combat, breakthroughs, deviation and the time-skip all produce damage,
 * injuries and counters; they hand the resulting state here and this module
 * returns a `DeathCause` or `null`. Centralising it matters for a permadeath
 * game: with five modules each allowed to set `alive = false`, the run ledger
 * eventually disagrees with itself about how someone died, and there is no
 * reload to paper over it.
 *
 * The five ways the survival layer kills you, and where each threshold comes
 * from (all constants live in `schema/cultivation.ts`):
 *
 *   combat_defeat       hp reaches 0
 *   starvation          STARVATION_TURNS consecutive turns at 0 satiety
 *   lifespan_exhausted  age reaches the realm's lifespanYears
 *   stagnation_aging    stagnationYearsForOrdinal() without advancing a rank
 *   untreated_injuries  LETHAL_UNTREATED_INJURIES untreated - fight, or wait
 *
 * Note the shape of that last one. It kills two ways, and it needs both.
 * Forcing a fight at three torn meridians is fatal immediately, which is why
 * the caller declares `forcingCombat`. And doing nothing at all is fatal in
 * BLEED_OUT_TURNS, because a wound that nothing heals on its own does not
 * politely wait for you to decide. Without the second route the state was a
 * trap with no exit: the run could not be advanced, could not be healed, and
 * could not be ended, because the only door out was a fight the player had
 * just been told would kill them. Standing still has to be a way to die.
 */

import {
    BLEED_OUT_TURNS,
    LETHAL_UNTREATED_INJURIES,
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
import { bleedingInjuryCount, untreatedInjuryCount } from './injuries.js';
import { hasBody, isGoingConcern, isTerminal } from './existence.js';

// ─────────────────────────────────────────────────────────────────────────
// SATIETY
// Food is a logistics problem, not a stat. At SATIETY_COST_PER_ACTION = 2 out
// of SATIETY_MAX = 100, a full belly buys exactly 50 turn-consuming actions,
// and five turns past empty you are dead. A decade of seclusion is therefore
// impossible without either provisions or a grain-abstinence pill - which is
// the correct answer, and the reason that pill effect exists in the schema.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The point at which somebody should be told they are hungry.
 *
 * A tenth of a full belly, which at the base burn is five turn-consuming
 * actions from empty and five more from dead. Late enough that it is not
 * nagging, early enough to be worth acting on - a meal costs one spirit stone.
 *
 * It lives here rather than in a narrator because two paths need it and they
 * disagreed: the time-skip narration warned at this figure and the work path
 * had no warning at all. Measured by playing, fourteen straight years of work
 * took a cultivator from full health to half, satiety to this line, and the
 * purse past a thousand stones, and never once mentioned food.
 */
export const LOW_SATIETY = Math.round(SATIETY_MAX * 0.2);

/** Turn-consuming actions a full belly covers. */
export const ACTIONS_PER_FULL_SATIETY = Math.floor(SATIETY_MAX / SATIETY_COST_PER_ACTION);

export interface SatietyState {
    satiety: number;
    starvationTurns: number;
}

// ─────────────────────────────────────────────────────────────────────────
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
// ─────────────────────────────────────────────────────────────────────────

/**
 * What one day's hunger costs at this realm, as a fraction of a mortal's.
 *
 * Indexed by realm rather than by ordinal: the change happens at realm
 * boundaries, which is where everything else about a body changes. Zero from
 * Deity Transformation up, and zero means no satiety is burned and starvation
 * cannot occur at all.
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

/** The multiplier for this rung. */
export function satietyBurnMultiplier(realmOrdinal: number): number {
    return SATIETY_BURN_BY_REALM[realmForOrdinal(realmOrdinal).key];
}

/** Whether this cultivator still has to eat at all. */
export function stillNeedsToEat(realmOrdinal: number): boolean {
    return satietyBurnMultiplier(realmOrdinal) > 0;
}

/**
 * Burn satiety for `actions` turn-consuming actions.
 *
 * Any action taken while already at zero satiety advances the starvation
 * counter by one; any action taken with food in the belly resets it. Pure -
 * returns the new values, writes nothing.
 *
 * `realmOrdinal` scales the cost by {@link satietyBurnMultiplier}. A cultivator
 * whose multiplier is zero burns nothing and can never advance the starvation
 * counter, which is the whole of the Deity Transformation rule.
 */
export function burnSatiety(
    state: SatietyState,
    actions = 1,
    realmOrdinal = 0
): SatietyState {
    const count = Math.max(0, Math.floor(actions));
    if (count === 0) return { ...state };

    const multiplier = satietyBurnMultiplier(realmOrdinal);
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
 *
 * `Infinity` above the point where hunger stops - a cultivator who does not eat
 * is not on a long clock, they are off it, and a finite number here would be
 * rendered somewhere as a countdown that never moves.
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

// ─────────────────────────────────────────────────────────────────────────
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
// ─────────────────────────────────────────────────────────────────────────

/** What one day of this stretch costs the belly. Zero above Nascent Soul. */
function satietyPerDay(realmOrdinal: number): number {
    return SATIETY_COST_PER_ACTION * satietyBurnMultiplier(realmOrdinal);
}

/**
 * Days one full ration covers at this rung.
 *
 * `Infinity` where hunger has stopped: rations are not consumed at all there,
 * and a finite number would invite a caller to make somebody buy food they
 * cannot eat.
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
 *
 * The belly covers the first stretch on its own and is counted first, which is
 * why this is the number to price a purchase at rather than `days / 50`: a
 * cultivator who has just eaten should not be sold food for the days their own
 * stomach already covers.
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
 *
 * Three outcomes and not two, because the simulation genuinely has three and
 * conflating the middle one with either neighbour is how this got missed:
 *
 *   `fed`      the whole stretch is provisioned. It runs its length.
 *   `ejected`  the food runs out partway. The skip stops there and the
 *              cultivator walks out alive, having spent `coveredDays` of the
 *              `days` they asked for and gained nothing for the rest.
 *   `fatal`    there is no interrupt left to fire, because entering already
 *              empty-bellied and empty-packed is a state the skip has decided
 *              you were warned about. They die on `fatalOnDay`, whatever
 *              duration was asked for.
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
 *
 * Pure, and takes no view on what the caller should do with the answer. A
 * caller that intends to refuse reads `fatal` and `reason`; one that intends
 * to warn about a wasted decade reads `outcome === 'ejected'` and
 * `wastedDays`; one that is buying reads `rationsShort`.
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

// ─────────────────────────────────────────────────────────────────────────
// BLEEDING OUT
//
// The sibling of starvation, and built as one deliberately: a persisted
// counter, a pure advance-or-reset function, a "how long have I got" helper,
// and one clause in the death gate. Where hunger measures turns with nothing
// in the belly, this measures turns with the meridians open.
//
// It exists because the lethal-injury state was unloseable. Untreated injuries
// raise deviation risk; a deviation adds another injury; nothing heals on its
// own; and the only way `untreated_injuries` could be reached was by forcing a
// fight, which is precisely what a player who has just read "any further
// combat is fatal" will not do. The run could not be advanced, healed or
// ended. You might still bleed out doing nothing, and now you do.
//
// ── Why there is no realm ceiling on this ────────────────────────────────
// Starvation has one: `stillNeedsToEat` is false from Deity Transformation up,
// because that realm is where a body stops taking anything from the world,
// meals included. There is no equivalent line for meridian damage, and putting
// one in would be the mistake the charter names. Hunger tapers because food
// stops being what sustains the body; nothing anywhere on the ladder makes a
// torn channel less load-bearing, and the higher the realm the more qi is
// being pushed through the tear. A Deity Transformation cultivator does not
// need to eat and still cannot circulate through a meridian that is open.
//
// So the gate is `hasBody(existence)` and nothing else - the same gate the
// whole flesh-arithmetic block already sits behind. A soul persisting without
// a body has no meridians to bleed from; everyone who has a body bleeds on the
// same clock, at ordinal 0 and at ordinal 40.
// ─────────────────────────────────────────────────────────────────────────

export interface BleedState {
    /** Untreated meridian injuries the body is currently carrying open. */
    untreatedInjuries: number;
    /** Consecutive turns spent at or above LETHAL_UNTREATED_INJURIES. */
    bleedingTurns: number;
}

/** Whether this many open wounds is the state that kills on its own. */
export function isBleedingOut(untreatedInjuries: number): boolean {
    return untreatedInjuries >= LETHAL_UNTREATED_INJURIES;
}

/**
 * Advance the bleed clock for `turns` turns.
 *
 * Any turn spent at or above the lethal untreated count advances the counter;
 * any turn spent below it resets the counter to zero, exactly as `burnSatiety`
 * clears `starvationTurns` on the first action taken with food in the belly.
 * Treating one wound out of three therefore buys the whole clock back, which
 * is the point: the counter measures the state you are in now, not the damage
 * you have taken over a life. Pure - returns the new values, writes nothing.
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
 * Turns of bleeding still survivable. Zero means the next one is fatal.
 *
 * `Infinity` when the untreated count is under the threshold, for the same
 * reason `turnsUntilStarvation` returns it above the hunger line: a cultivator
 * who is not bleeding is not on a long clock, they are off it, and a finite
 * number here would render as a countdown that never moves.
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

// ─────────────────────────────────────────────────────────────────────────
// AGING
// ─────────────────────────────────────────────────────────────────────────

/** Years of lifespan remaining at the current realm. Negative means overdue. */
export function lifespanRemaining(
    cultivator: Pick<Cultivator, 'realmOrdinal' | 'age'> &
        Partial<Pick<Cultivator, 'immortalStatus'>>
): number {
    return (
        effectiveLifespanYears(cultivator.realmOrdinal, cultivator.immortalStatus ?? 'none') -
        cultivator.age
    );
}

/**
 * Years of stagnation remaining before death by aging.
 *
 * `yearsAtCurrentRealm` is reset by ANY rank advance, not only by crossing a
 * realm boundary - the schema's phrasing is "years at the current realm without
 * advancing", and advancing a sub-rank is advancing. Read the other way, Qi
 * Condensation's thirteen layers would be an unsurvivable 50-year budget for
 * a climb that costs a single root about forty years, and every muddled root
 * would die before Foundation regardless of play. The forgiving reading is the
 * one the numbers were built for.
 */
export function stagnationRemaining(
    cultivator: Pick<Cultivator, 'yearsAtCurrentRealm' | 'realmOrdinal'>
): number {
    return stagnationYearsForOrdinal(cultivator.realmOrdinal) - cultivator.yearsAtCurrentRealm;
}

// ─────────────────────────────────────────────────────────────────────────
// SUICIDAL CHOICES
// The engine will not refuse an obviously fatal choice. It will make it fatal.
// ─────────────────────────────────────────────────────────────────────────

export interface SuicideAssessment {
    suicidal: boolean;
    reasons: string[];
}

/**
 * Whether entering combat right now is an obviously fatal choice: below
 * SUICIDAL_HP_FRACTION of max HP, or at the lethal untreated-injury threshold.
 *
 * Advisory on its own - it becomes a death only through
 * `evaluateDeathConditions` with `forcingCombat` set.
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
    const untreated = untreatedInjuryCount(cultivator.injuries);
    if (untreated >= LETHAL_UNTREATED_INJURIES) {
        reasons.push(`${untreated} untreated meridian injuries`);
    }
    return { suicidal: reasons.length > 0, reasons };
}

// ─────────────────────────────────────────────────────────────────────────
// THE DEATH CHECK
// ─────────────────────────────────────────────────────────────────────────

export interface DeathContext {
    /**
     * The cultivator is entering or continuing combat right now. Required for
     * the suicidal-HP cause and for the IMMEDIATE untreated-injury cause, both
     * of which are about the choice rather than the state.
     *
     * It is not required for the slow untreated-injury cause. Three open
     * meridians kill on their own in BLEED_OUT_TURNS whatever the cultivator
     * chooses to do, including nothing.
     */
    forcingCombat?: boolean;
}

/**
 * The single death gate.
 *
 * Returns the cause, or `null` if the cultivator lives. Checks run in a fixed
 * order and the FIRST match wins, so a cultivator who is simultaneously at 0 HP
 * and out of lifespan is recorded as having died in combat. The ordering is
 * most-immediate-cause-first: what actually stopped the heart this turn beats
 * the slow condition that would have stopped it eventually.
 *
 * Each threshold is `>=`, so death lands exactly ON the documented number: the
 * fifth consecutive starving turn, the fiftieth stagnant year, the hundredth
 * birthday at Qi Condensation. Not one turn before, not one after.
 */
export function evaluateDeathConditions(
    cultivator: Pick<
        Cultivator,
        'hp' | 'maxHp' | 'satiety' | 'starvationTurns' | 'age' | 'realmOrdinal' |
        'yearsAtCurrentRealm' | 'injuries' | 'alive'
    > & Partial<Pick<Cultivator, 'existenceState' | 'immortalStatus' | 'bleedingTurns'>>,
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
        if (cultivator.hp <= 0) return 'combat_defeat';

        // Starvation cannot kill somebody who has stopped eating. The counter
        // is not reset here on purpose - `burnSatiety` clears it the moment the
        // realm is reached, and a stale value should never resurrect the cause.
        if (
            stillNeedsToEat(cultivator.realmOrdinal) &&
            cultivator.starvationTurns >= STARVATION_TURNS
        ) {
            return 'starvation';
        }

        if (ctx.forcingCombat) {
            if (bleedingInjuryCount(cultivator.injuries) >= LETHAL_UNTREATED_INJURIES) {
                return 'untreated_injuries';
            }
            const hpFraction = cultivator.maxHp > 0 ? cultivator.hp / cultivator.maxHp : 0;
            if (hpFraction < SUICIDAL_HP_FRACTION) return 'obviously_fatal_choice';
        }

        // The same cause, reached by waiting instead of by fighting. It sits
        // below starvation because the ordering is most-immediate-first and a
        // bleed runs on ninety turns against hunger's five; it sits above
        // lifespan and settling because those run on years. No realm gate: see
        // the BLEEDING OUT banner above for why hunger has one and this does
        // not. `>=` like every other threshold here, so death lands exactly on
        // the ninetieth turn.
        if (
            isBleedingOut(bleedingInjuryCount(cultivator.injuries)) &&
            (cultivator.bleedingTurns ?? 0) >= BLEED_OUT_TURNS
        ) {
            return 'untreated_injuries';
        }
    }

    // A True Immortal is through the Lid and out of the world's arithmetic
    // entirely. A False Immortal is emphatically NOT immortal - they get a vast
    // finite span, and `effectiveLifespanYears` is where that lives.
    if (status !== 'true_immortal' && cultivator.age >= effectiveLifespanYears(cultivator.realmOrdinal, status)) {
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
        Partial<Pick<Cultivator, 'immortalStatus'>>
): string {
    const who = `${cultivator.name}, ${rankName(cultivator.realmOrdinal)}, age ${Math.floor(cultivator.age)}`;
    switch (cause) {
        case 'combat_defeat':
            return `${who}: killed in combat.`;
        case 'obviously_fatal_choice':
            return `${who}: forced a fight while barely able to stand, and did not survive it.`;
        case 'lifespan_exhausted':
            return `${who}: lifespan exhausted at the limit of ${effectiveLifespanYears(cultivator.realmOrdinal, cultivator.immortalStatus ?? 'none')} years. Died of old age.`;
        case 'stagnation_aging':
            return `${who}: spent ${Math.round(stagnationYearsForOrdinal(cultivator.realmOrdinal))} years without advancing a single rank. Died of old age at a bottleneck never crossed.`;
        case 'untreated_injuries':
            // Deliberately silent on which of the two routes it was. The cause
            // reaches here without a context and inventing "fought" for a
            // cultivator who bled out sitting in a cave would be the engine
            // narrating something it does not know. What it does know is the
            // count and the outcome.
            return `${who}: carried ${LETHAL_UNTREATED_INJURIES} or more untreated meridian injuries. The meridians gave out.`;
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
