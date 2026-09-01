/**
 * Existence states - what happens when "body destroyed = dead" stops being true.
 *
 * At low realms that equivalence holds absolutely, and it is most of what makes
 * the early game frightening. Nascent Soul is the qualitative break: the soul
 * can persist without the body, and from there a cultivator is better modelled
 * as a persistent identity that may occupy several physical states over time
 * than as one body plus one row.
 *
 * Two rules keep this from becoming automatic immortality, which would wreck
 * the game:
 *
 *  1. NASCENT SOUL IS A GATE, NOT A GRANT. Below ordinal 21 essentially none of
 *     these states are reachable. Above it they become *possible*, and nothing
 *     more. Not every Nascent Soul cultivator can do all of it.
 *
 *  2. SURVIVAL IS CONDITIONAL, NEVER AUTOMATIC. Surviving your own death takes
 *     soul strength, a compatible vessel, a treasure, a technique, an
 *     environment, outside help, or - most often - having prepared in advance.
 *     A powerful cultivator can still die permanently, and most do. The purpose
 *     is not to stop killing people; it is to make death and identity more
 *     interesting the deeper cultivation goes.
 *
 * This module decides whether a transition is LEGAL and what it costs. It never
 * decides that one happens for narrative reasons, and it holds no database: the
 * caller supplies what the run actually has (a prepared vessel, a soul-lantern,
 * a sect elder standing by) and applies what comes back.
 */

import {
    type AmbientQi,
    type Cultivator,
    type ExistenceState,
    type Injury,
    type SoulState
} from '../../schema/cultivation.js';
import { REALM_TIERS, rankName } from './realms.js';
import { aggregateInjuryPenalties, createInjury } from './injuries.js';
import { ordinaryWoundFor } from './which-wound-an-ordinary-injury-is.js';
// Upward in the dependency order and deliberately so: there is one answer in
// this codebase to what a strike of heavenly lightning costs a body, and the
// descent has to weather the same one rather than carry a second. Nothing in
// `breakthrough.ts` or its transitive imports reaches back here, so this is a
// dependency rather than a cycle - checked, and worth re-checking if either
// file grows an import.
import { TRIBULATION_LETHAL_STRIKES, tribulationStrikeSurvival } from './breakthrough.js';
import type { CultivationRNG } from './rng.js';

// ─────────────────────────────────────────────────────────────────────────
// THE GATE
// ─────────────────────────────────────────────────────────────────────────

/**
 * First ordinal of Nascent Soul: the rank at which the core births an infant
 * soul that can survive the destruction of the body. Everything in this file
 * is gated on it.
 */
export const NASCENT_SOUL_ORDINAL = REALM_TIERS.find(t => t.key === 'nascent_soul')!.ordinalStart;

/**
 * States available to anyone at all, at any realm. Below Nascent Soul these are
 * the only outcomes: you are here, you are dead, or nobody knows which.
 */
export const MORTAL_EXISTENCE_STATES = [
    'alive', 'physically_dead', 'missing', 'unknown'
] as const;

/**
 * States that only become reachable at Nascent Soul and above, and even then
 * only under conditions. Reachable is not the same as available.
 */
export const PROFOUND_EXISTENCE_STATES = [
    'soul_preserved', 'remnant', 'sealed', 'possessing', 'reincarnated', 'reconstructed'
] as const;

/** The subset of existence states gated behind Nascent Soul. */
export type ProfoundExistenceState = typeof PROFOUND_EXISTENCE_STATES[number];

export function requiresNascentSoul(state: ExistenceState): boolean {
    return (PROFOUND_EXISTENCE_STATES as readonly ExistenceState[]).includes(state);
}

// ─────────────────────────────────────────────────────────────────────────
// READING A STATE
// ─────────────────────────────────────────────────────────────────────────

/**
 * The only terminal state. Everything else is either playable or unresolved.
 *
 * Note that 'missing' and 'unknown' are deliberately NOT terminal: they are
 * correct answers rather than placeholders, and a cultivator who vanished into
 * a ruin in year 50 may be found sealed in year 4000 with their grudges intact.
 */
export function isTerminal(state: ExistenceState): boolean {
    return state === 'physically_dead';
}

/**
 * Whether this identity is still a going concern - the honest replacement for
 * the `alive` boolean, and what that boolean should be recomputed from.
 *
 * A remnant is excluded on purpose. A remnant is not the person; it is
 * something the person left behind that can talk.
 */
export function isGoingConcern(state: ExistenceState): boolean {
    switch (state) {
        case 'alive':
        case 'soul_preserved':
        case 'possessing':
        case 'reincarnated':
        case 'reconstructed':
        case 'sealed':
            return true;
        case 'remnant':
        case 'physically_dead':
            return false;
        case 'missing':
        case 'unknown':
            // Unresolved is not dead. The world may believe otherwise, and the
            // world is frequently wrong.
            return true;
    }
}

/** Whether this identity can take actions in the world right now. */
export function canAct(state: ExistenceState): boolean {
    switch (state) {
        case 'alive':
        case 'possessing':
        case 'reincarnated':
        case 'reconstructed':
            return true;
        case 'soul_preserved':
            // Can act, badly, and cannot do anything that needs hands.
            return true;
        case 'sealed':
        case 'remnant':
        case 'physically_dead':
        case 'missing':
        case 'unknown':
            return false;
    }
}

/** Whether the body's own arithmetic - hunger, HP, ageing - still applies. */
export function hasBody(state: ExistenceState): boolean {
    switch (state) {
        case 'alive':
        case 'possessing':
        case 'reincarnated':
        case 'reconstructed':
        case 'sealed':
            return true;
        case 'soul_preserved':
        case 'remnant':
        case 'physically_dead':
        case 'missing':
        case 'unknown':
            return false;
    }
}

/** Recompute the convenience boolean from the authoritative state. */
export function aliveFlagFor(state: ExistenceState): boolean {
    return isGoingConcern(state);
}

// ─────────────────────────────────────────────────────────────────────────
// LEGALITY OF A TRANSITION
// ─────────────────────────────────────────────────────────────────────────

/**
 * What the run has actually arranged. The engine holds no database, so the
 * caller supplies these from real rows; nothing here is assumed.
 */
export interface ExistenceRequirements {
    /** A body prepared, bought or stolen in advance, and its id. */
    vesselId?: string | null;
    /**
     * How compatible the vessel is with this soul, 0..1. A powerful soul does
     * not make every vessel suitable, and an incompatible one is worse than
     * none.
     */
    vesselCompatibility?: number;
    /** A soul-preserving treasure or technique is in hand. */
    soulAnchor?: boolean;
    /** A technique for this specific transition has been mastered. */
    technique?: boolean;
    /** Someone competent is present and willing to help. */
    assistance?: boolean;
    /** Materials and spirit stones sufficient for a reconstruction. */
    resources?: boolean;
    /** The transition was planned rather than improvised at the last moment. */
    prepared?: boolean;
}

export interface TransitionCheck {
    legal: boolean;
    /** Machine-readable reason when illegal; null when legal. */
    reason: string | null;
    /** Human-facing explanation the UI can print verbatim. */
    detail: string;
}

/** What each profound state actually needs, beyond the Nascent Soul gate. */
const TRANSITION_REQUIREMENTS: Record<
    ProfoundExistenceState,
    (req: ExistenceRequirements) => TransitionCheck | null
> = {
    soul_preserved: req =>
        req.soulAnchor || req.technique
            ? null
            : deny('no_soul_anchor', 'Nothing was prepared to hold a soul that has lost its body.'),
    remnant: req =>
        req.prepared || req.technique
            ? null
            : deny('no_imprint_prepared', 'Leaving an imprint has to be arranged before it is needed.'),
    sealed: req =>
        req.prepared || req.assistance
            ? null
            : deny('no_seal', 'A seal does not close itself, and nobody was there to close it.'),
    possessing: req =>
        req.vesselId
            ? null
            : deny('no_vessel', 'There was no body to move into.'),
    reincarnated: req =>
        req.technique || req.assistance
            ? null
            : deny('no_passage', 'Nothing carried the soul into a new life; it simply dispersed.'),
    reconstructed: req =>
        req.resources && (req.assistance || req.technique)
            ? null
            : deny('no_means_to_rebuild', 'Rebuilding a body takes materials and someone who knows how.')
};

function deny(reason: string, detail: string): TransitionCheck {
    return { legal: false, reason, detail };
}

/**
 * Whether this cultivator may enter `target` right now.
 *
 * Refuses below Nascent Soul for every profound state, and refuses above it
 * whenever the conditions were not actually arranged. "You are strong enough"
 * is necessary and never sufficient.
 */
export function canEnterExistenceState(
    cultivator: Pick<Cultivator, 'realmOrdinal'> & Partial<Pick<Cultivator, 'existenceState' | 'soulState'>>,
    target: ExistenceState,
    requirements: ExistenceRequirements = {}
): TransitionCheck {
    const current = cultivator.existenceState ?? 'alive';

    if (isTerminal(current)) {
        return deny('already_terminal', 'This identity ended. Nothing transitions out of that.');
    }

    if (!requiresNascentSoul(target)) {
        return { legal: true, reason: null, detail: 'Available at any realm.' };
    }

    if (cultivator.realmOrdinal < NASCENT_SOUL_ORDINAL) {
        return deny(
            'below_nascent_soul',
            `At ${rankName(cultivator.realmOrdinal)} the soul cannot persist without the body. ` +
            'Below Nascent Soul, a destroyed body is simply a death.'
        );
    }

    if ((cultivator.soulState ?? 'intact') === 'fading' && target !== 'remnant') {
        return deny(
            'soul_too_weak',
            'A fading soul does not have enough of itself left to make the crossing.'
        );
    }

    return (
        TRANSITION_REQUIREMENTS[target as ProfoundExistenceState](requirements) ?? {
            legal: true,
            reason: null,
            detail: 'The conditions for this transition are met.'
        }
    );
}

// ─────────────────────────────────────────────────────────────────────────
// SURVIVING YOUR OWN DEATH
// ─────────────────────────────────────────────────────────────────────────

export interface DestructionOutcome {
    state: ExistenceState;
    soulState: SoulState;
    /** How much of the original person came through, 0..1. */
    identityContinuity: number;
    /** Fraction of cultivation progress that did NOT survive the transition. */
    cultivationLost: number;
    /** The body now occupied, if any. */
    bodyId: string | null;
    /** Itemised reasons, so a player can see why they did or did not survive. */
    factors: { source: string; detail: string }[];
    narrationHint: string;
}

/**
 * Resolve the destruction of a cultivator's body.
 *
 * The default answer is death, at every realm, and it stays the default above
 * Nascent Soul too. Survival requires that the cultivator BE at Nascent Soul,
 * that something was actually arranged, and then that a roll go their way.
 * "Most do" die permanently, and this function is where that is enforced.
 *
 * Consumes exactly two samples on every path, so the stream stays aligned.
 */
export function resolveBodilyDestruction(
    cultivator: Pick<Cultivator, 'realmOrdinal' | 'cultivationProgress' | 'injuries'> &
        Partial<Pick<Cultivator, 'soulState' | 'existenceState'>>,
    requirements: ExistenceRequirements,
    rng: CultivationRNG
): DestructionOutcome {
    const survivalRoll = rng.next();
    const severityRoll = rng.next();
    const factors: { source: string; detail: string }[] = [];

    const dead = (detail: string): DestructionOutcome => {
        factors.push({ source: 'outcome', detail });
        return {
            state: 'physically_dead',
            soulState: cultivator.soulState ?? 'intact',
            identityContinuity: 0,
            cultivationLost: 1,
            bodyId: null,
            factors,
            narrationHint: `The body was destroyed and nothing survived it. ${detail}`
        };
    };

    if (cultivator.realmOrdinal < NASCENT_SOUL_ORDINAL) {
        return dead(
            `At ${rankName(cultivator.realmOrdinal)} there is no infant soul to survive the body.`
        );
    }
    factors.push({
        source: 'nascent_soul',
        detail: 'The soul is capable of persisting without the body.'
    });

    // Which route out was actually prepared? Preference order is the order of
    // how much of the person each one preserves.
    const route: ExistenceState | null = requirements.vesselId
        ? 'possessing'
        : requirements.soulAnchor || requirements.technique
            ? 'soul_preserved'
            : null;

    if (route === null) {
        return dead('Nothing had been arranged. The soul had nowhere to go and dispersed.');
    }

    const legality = canEnterExistenceState(cultivator, route, requirements);
    if (!legality.legal) return dead(legality.detail);

    // The roll. Preparation moves it a long way; nothing removes it.
    const injuries = aggregateInjuryPenalties(cultivator.injuries);
    let chance = BASE_SOUL_SURVIVAL;
    if (requirements.prepared) chance += PREPARED_BONUS;
    if (requirements.assistance) chance += ASSISTANCE_BONUS;
    if (requirements.technique) chance += TECHNIQUE_BONUS;
    if (route === 'possessing') {
        chance += (clamp01(requirements.vesselCompatibility ?? 0) - 0.5) * VESSEL_SWING;
    }
    chance -= injuries.breakthroughPenalty;
    chance -= SOUL_STATE_PENALTY[cultivator.soulState ?? 'intact'];
    chance = Math.max(MIN_SOUL_SURVIVAL, Math.min(MAX_SOUL_SURVIVAL, chance));
    factors.push({
        source: 'survival_chance',
        detail: `Survival was ${(chance * 100).toFixed(1)}% given what had been arranged.`
    });

    if (survivalRoll >= chance) {
        return dead('What had been arranged was not enough, and the soul went with the body.');
    }

    // Survived, at a cost. Nothing comes through whole.
    const soulState: SoulState = severityRoll < 0.5 ? 'damaged' : 'fragmented';
    const continuity = soulState === 'damaged' ? 0.8 : 0.55;
    const cultivationLost = soulState === 'damaged' ? 0.3 : 0.6;

    factors.push({
        source: 'cost',
        detail: `The soul came through ${soulState}; ${Math.round(cultivationLost * 100)}% of the cultivation did not.`
    });

    return {
        state: route,
        soulState,
        identityContinuity: continuity,
        cultivationLost,
        bodyId: route === 'possessing' ? requirements.vesselId ?? null : null,
        factors,
        narrationHint:
            route === 'possessing'
                ? `The body was destroyed. The soul reached the prepared vessel and took it, ${soulState}, ` +
                  `with ${Math.round(cultivationLost * 100)}% of the cultivation left behind.`
                : `The body was destroyed. The soul persists without one, ${soulState}, ` +
                  `with ${Math.round(cultivationLost * 100)}% of the cultivation left behind.`
    };
}

/** Base chance a prepared Nascent Soul cultivator survives losing their body. */
export const BASE_SOUL_SURVIVAL = 0.25;
export const PREPARED_BONUS = 0.25;
export const ASSISTANCE_BONUS = 0.15;
export const TECHNIQUE_BONUS = 0.15;
/** How far vessel compatibility swings a possession attempt, either way. */
export const VESSEL_SWING = 0.4;
export const MIN_SOUL_SURVIVAL = 0.02;
export const MAX_SOUL_SURVIVAL = 0.9;

const SOUL_STATE_PENALTY: Record<SoulState, number> = {
    intact: 0,
    damaged: 0.15,
    fragmented: 0.3,
    fading: 0.5
};

// ─────────────────────────────────────────────────────────────────────────
// REMNANTS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Continuity ceiling for anything left behind rather than carried across.
 *
 * A remnant will, projection, obsession or inheritance guardian may say "I
 * founded this sect" in perfect sincerity and be wrong. Capping continuity here
 * is what stops the rest of the engine treating it as the founder.
 */
export const MAX_REMNANT_CONTINUITY = 0.35;

export function makeRemnantContinuity(raw: number): number {
    return Math.min(MAX_REMNANT_CONTINUITY, clamp01(raw));
}

/**
 * Whether this identity is actually the original person, for any system that
 * needs to care - inheritance, grudges, recognition, sect records.
 */
export function isTheSamePerson(
    cultivator: Partial<Pick<Cultivator, 'existenceState' | 'identityContinuity'>>
): boolean {
    const state = cultivator.existenceState ?? 'alive';
    if (state === 'remnant') return false;
    return (cultivator.identityContinuity ?? 1) >= 0.5;
}

// ─────────────────────────────────────────────────────────────────────────
// THE LID, AND WHAT IT DOES TO PEOPLE ON THE WRONG SIDE OF IT
//
// Neither crossing is impossible and both are ruinously expensive, which is
// the shape the setting asks for. Going up without having completed the last
// crossing is not a fight - it is a pressure a body at that realm cannot
// exist at. Coming back down draws lightning, because the Lid does not
// distinguish a hole made outward from one made inward.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Whether this cultivator can exist beyond the Lid at all.
 *
 * Only a True Immortal. Anyone else who reaches the other side is crushed -
 * not attacked, simply unable to hold together at that pressure. This is a
 * refusal, not a difficulty, and callers must gate on it rather than rolling.
 */
export function canExistBeyondTheLid(
    cultivator: Partial<Pick<Cultivator, 'immortalStatus'>>
): boolean {
    return (cultivator.immortalStatus ?? 'none') === 'true_immortal';
}

export interface LidTransitCheck {
    permitted: boolean;
    /** Null when permitted; a machine-readable refusal otherwise. */
    reason: string | null;
    /**
     * Tribulation strikes the transit itself draws. Zero when refused - a
     * cultivator who is crushed never gets as far as being struck.
     */
    strikes: number;
    detail: string;
}

/** Strikes drawn by an immortal reaching back down through their own hole. */
export const DESCENT_TRIBULATION_STRIKES = 9;

/**
 * Price a passage through the Lid.
 *
 * Upward for anyone below True Immortal: refused outright. Downward for a True
 * Immortal: permitted, and it draws the heaviest tribulation in the game,
 * because a hole made inward is still a hole. The caller resolves the strikes
 * through the normal tribulation machinery and applies the result; nothing
 * about this is a free travel option.
 */
export function evaluateLidTransit(
    cultivator: Partial<Pick<Cultivator, 'immortalStatus'>>,
    direction: 'up' | 'down'
): LidTransitCheck {
    const immortal = canExistBeyondTheLid(cultivator);

    if (direction === 'up' && !immortal) {
        return {
            permitted: false,
            reason: 'crushed_beyond_the_lid',
            strikes: 0,
            detail:
                'Nothing below True Immortal can exist at that pressure. This is not a fight that ' +
                'can be lost well; the body simply stops being able to hold together.'
        };
    }

    if (direction === 'up') {
        return {
            permitted: true,
            reason: null,
            strikes: 0,
            detail: 'A True Immortal belongs on that side, and passes without incident.'
        };
    }

    if (!immortal) {
        return {
            permitted: false,
            reason: 'not_beyond_the_lid',
            strikes: 0,
            detail: 'There is nothing to come down from.'
        };
    }

    return {
        permitted: true,
        reason: null,
        strikes: DESCENT_TRIBULATION_STRIKES,
        detail:
            `Coming back down opens the Lid a second time. The seam discharges: ` +
            `${DESCENT_TRIBULATION_STRIKES} strikes, and the descent is not survivable by being owed a favour.`
    };
}

/**
 * What the descent actually does to the body making it.
 *
 * `evaluateLidTransit` prices the passage and stops there, deliberately: it is
 * a ruling, not a resolution, and the strikes it names have to be weathered
 * through the same machinery every other tribulation in the game runs on. This
 * is that call, and it exists because the alternative was a caller in the
 * narration tier deciding what nine strikes of lightning are worth.
 *
 * ONE IMPLEMENTATION OF WHAT A STRIKE COSTS. `tribulationStrikeSurvival` is
 * `breakthrough.ts`'s, `TRIBULATION_LETHAL_STRIKES` is its constant, and the
 * injuries come out of `createInjury` on the caller's seeded stream. Nothing
 * here is a second opinion about lightning; the only thing this file
 * contributes is HOW MANY, and that number is `DESCENT_TRIBULATION_STRIKES`,
 * which is above the heaviest crossing in the game.
 *
 * The result is meant to be survivable and probably not. Nine strikes at the
 * per-strike odds a True Immortal carries is a decision somebody makes once
 * about something they care about more than continuing.
 */
export interface DescentOutcome {
    strikes: number;
    /** How many landed. Three is fatal, exactly as it is on the way up. */
    struck: number;
    survived: boolean;
    /** Per-strike survival, so a caller can show the price before it is paid. */
    perStrike: number;
    injuries: Injury[];
    detail: string;
}

export function resolveDescentStrikes(
    cultivator: Pick<Cultivator, 'attributes' | 'injuries' | 'immortalStatus'>,
    ambient: AmbientQi,
    rng: CultivationRNG,
    turn: number
): DescentOutcome {
    const transit = evaluateLidTransit(cultivator, 'down');
    const strikes = transit.strikes;
    const perStrike = tribulationStrikeSurvival(cultivator, ambient);

    const injuries: Injury[] = [];
    let struck = 0;

    // Every strike is rolled even after the fatal one, so the number of samples
    // drawn depends only on the transit and the stream stays aligned for
    // anything the caller rolls next. Same discipline as `resolveTribulation`.
    for (let strike = 0; strike < strikes; strike++) {
        if (rng.next() < perStrike) continue;
        struck++;
        if (struck <= TRIBULATION_LETHAL_STRIKES) {
            const severity = struck >= TRIBULATION_LETHAL_STRIKES ? 'crippling' : 'serious';
            injuries.push(createInjury(
                {
                    severity,
                    source: 'tribulation',
                    turn,
                    woundType: ordinaryWoundFor('tribulation', severity),
                    description:
                        `The seam discharged: strike ${strike + 1} of ${strikes}, coming down.`
                },
                rng
            ));
        }
    }

    const survived = struck < TRIBULATION_LETHAL_STRIKES;
    return {
        strikes,
        struck,
        survived,
        perStrike,
        injuries,
        detail: survived
            ? `${struck} of ${strikes} strikes struck home coming down `
              + `(${(perStrike * 100).toFixed(0)}% survival per strike). They arrived.`
            : `${struck} of ${strikes} strikes struck home coming down `
              + `(${(perStrike * 100).toFixed(0)}% survival per strike). They did not arrive, and `
              + 'there is nothing at the bottom of it for anybody to find.'
    };
}

// ─────────────────────────────────────────────────────────────────────────
// ENDING A RUN DELIBERATELY
// ─────────────────────────────────────────────────────────────────────────

/**
 * Whether this cultivator may end their run by choice rather than by dying.
 *
 * True Immortal only, and deliberately not generalised. Permadeath everywhere
 * else is untouched: there is no quit action at Qi Condensation, no honourable
 * retirement at Core Formation. Being able to stop is part of what ascension
 * IS - go through, settle affairs, leave what you leave, step off the ladder.
 *
 * Reaching the top does not force it. A player may keep playing as a True
 * Immortal indefinitely, and that is a different game rather than an epilogue:
 * the concerns become obligation, legacy, what to leave behind, and what is
 * worth the price of reaching back down.
 *
 * The run ledger is the caller's business; this is only the eligibility rule.
 * A run closed this way is recorded as ended by ascension rather than by
 * death, which in a game where nearly every run ends in a corpse is the rarest
 * line in the ledger.
 */
export function canEndRunVoluntarily(
    cultivator: Partial<Pick<Cultivator, 'immortalStatus' | 'existenceState'>>
): TransitionCheck {
    const state = cultivator.existenceState ?? 'alive';
    if (!isGoingConcern(state)) {
        return deny('not_a_going_concern', 'This identity is not in a position to decide anything.');
    }
    if ((cultivator.immortalStatus ?? 'none') !== 'true_immortal') {
        return deny(
            'not_a_true_immortal',
            'A run ends when the cultivator dies. The single exception is a True Immortal, who may ' +
            'step off the ladder deliberately - and who had to punch a hole in the sky to earn the choice.'
        );
    }
    return {
        legal: true,
        reason: null,
        detail: 'A True Immortal may settle their affairs and end the run by ascension rather than by death.'
    };
}

function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}
