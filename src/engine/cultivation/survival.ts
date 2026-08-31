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
 *   stagnation_aging    STAGNATION_YEARS without advancing a rank
 *   untreated_injuries  LETHAL_UNTREATED_INJURIES untreated, and you fight anyway
 *
 * Note the shape of that last one. Standing at three torn meridians is legal
 * and survivable - you can crawl to a healer, buy a pill, sit out a season. It
 * is choosing to fight in that state that is fatal, which is why the caller
 * must declare `forcingCombat`. The engine does not stop you; it kills you.
 */

import {
    LETHAL_UNTREATED_INJURIES,
    SATIETY_COST_PER_ACTION,
    SATIETY_MAX,
    STAGNATION_YEARS,
    STARVATION_TURNS,
    SUICIDAL_HP_FRACTION,
    type Cultivator,
    type DeathCause
} from '../../schema/cultivation.js';
import { effectiveLifespanYears, rankName } from './realms.js';
import { untreatedInjuryCount } from './injuries.js';
import { hasBody, isGoingConcern, isTerminal } from './existence.js';

// ─────────────────────────────────────────────────────────────────────────
// SATIETY
// Food is a logistics problem, not a stat. At SATIETY_COST_PER_ACTION = 2 out
// of SATIETY_MAX = 100, a full belly buys exactly 50 turn-consuming actions,
// and five turns past empty you are dead. A decade of seclusion is therefore
// impossible without either provisions or a grain-abstinence pill - which is
// the correct answer, and the reason that pill effect exists in the schema.
// ─────────────────────────────────────────────────────────────────────────

/** Turn-consuming actions a full belly covers. */
export const ACTIONS_PER_FULL_SATIETY = Math.floor(SATIETY_MAX / SATIETY_COST_PER_ACTION);

export interface SatietyState {
    satiety: number;
    starvationTurns: number;
}

/**
 * Burn satiety for `actions` turn-consuming actions.
 *
 * Any action taken while already at zero satiety advances the starvation
 * counter by one; any action taken with food in the belly resets it. Pure -
 * returns the new values, writes nothing.
 */
export function burnSatiety(
    state: SatietyState,
    actions = 1
): SatietyState {
    const count = Math.max(0, Math.floor(actions));
    if (count === 0) return { ...state };

    let satiety = clampSatiety(state.satiety);
    let starvationTurns = Math.max(0, Math.floor(state.starvationTurns));

    // Actions that still have food to burn. Whole actions only - a half-fed
    // action does not exist.
    const fed = Math.min(count, Math.floor(satiety / SATIETY_COST_PER_ACTION));
    if (fed > 0) {
        satiety -= fed * SATIETY_COST_PER_ACTION;
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

/** Turns of starvation still survivable. Zero means the next one is fatal. */
export function turnsUntilStarvation(state: SatietyState): number {
    const fed = Math.floor(clampSatiety(state.satiety) / SATIETY_COST_PER_ACTION);
    const starvedSoFar = Math.max(0, Math.floor(state.starvationTurns));
    return fed + Math.max(0, STARVATION_TURNS - starvedSoFar);
}

function clampSatiety(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(SATIETY_MAX, Math.floor(n)));
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
    cultivator: Pick<Cultivator, 'yearsAtCurrentRealm'>
): number {
    return STAGNATION_YEARS - cultivator.yearsAtCurrentRealm;
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
     * the untreated-injury and suicidal-HP causes, which are about the choice,
     * not the state.
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
    > & Partial<Pick<Cultivator, 'existenceState' | 'immortalStatus'>>,
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

        if (cultivator.starvationTurns >= STARVATION_TURNS) return 'starvation';

        if (ctx.forcingCombat) {
            if (untreatedInjuryCount(cultivator.injuries) >= LETHAL_UNTREATED_INJURIES) {
                return 'untreated_injuries';
            }
            const hpFraction = cultivator.maxHp > 0 ? cultivator.hp / cultivator.maxHp : 0;
            if (hpFraction < SUICIDAL_HP_FRACTION) return 'obviously_fatal_choice';
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
    if (status === 'none' && cultivator.yearsAtCurrentRealm >= STAGNATION_YEARS) {
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
            return `${who}: spent ${STAGNATION_YEARS} years without advancing a single rank. Died of old age at a bottleneck never crossed.`;
        case 'untreated_injuries':
            return `${who}: fought with ${LETHAL_UNTREATED_INJURIES} or more untreated meridian injuries. The meridians gave out.`;
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
