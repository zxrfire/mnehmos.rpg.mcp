/**
 * Existence states - what happens when "body destroyed = dead" stops being true.
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
import {
    MIN_TRIBULATION_SURVIVAL,
    TRIBULATION_LETHAL_STRIKES,
    tribulationStrikeSurvival
} from './breakthrough.js';
import type { CultivationRNG } from './rng.js';

// THE GATE

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

// READING A STATE

/**
 * The only terminal state. Everything else is either playable or unresolved.
 */
export function isTerminal(state: ExistenceState): boolean {
    return state === 'physically_dead';
}

/**
 * Whether this identity is still a going concern - the honest replacement for the
 * `alive` boolean, and what that boolean should be recomputed from.
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

// LEGALITY OF A TRANSITION

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

// SURVIVING YOUR OWN DEATH

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

// REMNANTS

/**
 * Continuity ceiling for anything left behind rather than carried across.
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

// THE LID, AND WHAT IT DOES TO PEOPLE ON THE WRONG SIDE OF IT
//
// Neither crossing is impossible and both are ruinously expensive, which is
// the shape the setting asks for. Going up without having completed the last
// crossing is not a fight - it is a pressure a body at that realm cannot
// exist at. Coming back down draws lightning, because the Lid does not
// distinguish a hole made outward from one made inward.

/**
 * Whether this cultivator can exist beyond the Lid at all.
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
 * What the heavens draw on somebody who breaks a dao oath, by what they are.
 *
 * THE PUNISHMENT OF A CROSSING, SCALED. The design owner asked for the crossing
 * punishment and then caught the obvious thing about it: nine strikes is what
 * an immortal weathers coming down through their own hole, and handed to a Qi
 * Condensation disciple it is not a punishment, it is a delete. So the count is
 * the major realm they stand in - one strike at the bottom of the ladder, and
 * at the top it is exactly `DESCENT_TRIBULATION_STRIKES`, which is the whole
 * point: the full crossing punishment is the ceiling, and the only people who
 * reach it are the only people who could have survived a crossing.
 *
 * ── WHY THE HEAVENS ARE INVOLVED AT ALL ──────────────────────────────────
 *
 * The design owner, and it is the reason this is not simply a house sending
 * enforcers: *i do like how the lore meshes, that's when heaven punishes.
 * heaven doesn't care, but you did promise.*
 *
 * That is 天道无情 stated exactly. Nothing here is heaven taking an interest in
 * whether somebody is good. A dao oath is a structure a cultivator reaches up
 * and fastens themselves into, in front of a house whose whole business is
 * witnessing that it happened, and breaking it is the structure coming apart
 * with them inside it. Indifference is not absence: the lightning is the same
 * lightning a crossing draws, and it is drawn for the same reason, which is
 * that something load-bearing was asked of the sky and then withdrawn.
 */
export function strikesForABrokenDaoOath(realmIndex: number): number {
    return Math.min(DESCENT_TRIBULATION_STRIKES, Math.max(1, realmIndex + 1));
}

/**
 * How much harder each strike is than the one before it.
 *
 * The design owner: *each strike gets stronger.* It is the genre's own shape -
 * nobody describes a tribulation as nine of the same bolt - and it changes what
 * a tribulation IS to the person in it: a flat roll is a coin flipped nine
 * times, and an escalating one is a thing you are watching arrive. The last
 * strike of a nine is the one that kills people, and it should be.
 *
 * Subtracted from the per-strike survival, floored at
 * `MIN_TRIBULATION_SURVIVAL` so the ninth is never certain death for somebody
 * who had no business surviving the first.
 */
export const EACH_STRIKE_HARDER_BY = 0.04;

/**
 * What a strike takes off a body that weathered it, as a fraction of full HP.
 *
 * A TRIBULATION DOES NOT MISS. The design owner, correcting exactly this file:
 * *tribulations don't miss. that's not how it works. it only misses by hitting
 * someone else unlucky enough to be near you.* So there is no outcome here
 * where nothing happened. Every strike lands on somebody; the roll decides
 * whether it opens a wound or is merely worn, and `strikesTakenByBystanders`
 * decides whether the body it lands on is yours.
 *
 * The design owner: *even if you survive it's not free. you'd have to be lucky
 * (or dao protected by a dao protector) to get off scot-free.*
 *
 * Before this, a strike that was survived cost nothing whatever, so a
 * tribulation was a sequence of coin flips that either wounded you or did not
 * happen. That is not what standing in one is, and it is why the word
 * "survival" below is about what the strike DOES rather than whether it
 * arrives.
 *
 * A fraction rather than a figure, because HP is realm-scaled and a flat number
 * would be a scratch at the top of the ladder and a death at the bottom.
 */
export const WHAT_A_WEATHERED_STRIKE_STILL_TAKES = 0.12;

/**
 * The chance one strike goes into somebody standing nearby instead.
 *
 * The design owner, on the only way a tribulation fails to land on the person
 * who drew it: *it only misses by hitting someone else unlucky enough to be
 * near you (or you screwed them over on purpose).*
 *
 * Both halves of that are the same rule read from two ends, which is why there
 * is no second one for the deliberate case: standing near somebody who is about
 * to be struck is dangerous, and walking somebody there is what a person does
 * with a dangerous place. `who-is-left-when-somebody-dies.ts` and the ledger
 * price what it costs afterwards, exactly as they do for any other body the
 * player put in front of something.
 *
 * Rises with the crowd and never past half, because the bolt is coming for one
 * person and a crowd is cover rather than a substitute.
 */
export function strikesTakenByBystanders(nearby: number): number {
    if (nearby <= 0) return 0;
    return Math.min(0.5, 0.12 * nearby);
}

/**
 * Price a passage through the Lid.
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
 */
export interface DescentOutcome {
    strikes: number;
    /** How many landed. Three is fatal, exactly as it is on the way up. */
    struck: number;
    /**
     * Strikes weathered rather than taken. Not free - see
     * {@link WHAT_A_WEATHERED_STRIKE_STILL_TAKES}, which the caller prices
     * against the body it happened to.
     */
    weathered: number;
    /**
     * Strikes that landed on somebody else, by id, in the order they went.
     *
     * One of the two ways a strike does not land on the person who drew it.
     * See {@link strikesTakenByBystanders}.
     */
    tookItInstead: string[];
    /**
     * Things that were destroyed taking a strike meant for the body, by id.
     *
     * The other way, and the only one the person being struck is glad of.
     */
    brokeInstead: string[];
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
    return weatherTheStrikes(
        cultivator,
        ambient,
        rng,
        turn,
        evaluateLidTransit(cultivator, 'down').strikes,
        'coming down',
        'They arrived.',
        'They did not arrive, and there is nothing at the bottom of it for anybody to find.'
    );
}

/**
 * The heavens answering something, in the one shape they answer anything.
 *
 * Lifted whole out of `resolveDescentStrikes` when a second caller wanted the
 * same lightning: breaking a dao oath draws THE PUNISHMENT OF A CROSSING, and
 * a crossing is what this is. Copying the loop would have given the setting two
 * accounts of what a tribulation does to a body, and they would have drifted.
 *
 * Every strike is rolled even after the fatal one, so the number of samples
 * drawn depends only on `strikes` and the stream stays aligned for anything the
 * caller rolls next. Same discipline as `resolveTribulation`.
 */
export function weatherTheStrikes(
    cultivator: Pick<Cultivator, 'attributes' | 'injuries'>,
    ambient: AmbientQi,
    rng: CultivationRNG,
    turn: number,
    strikes: number,
    /** What the strikes were drawn by, for the wound's own description. */
    doing: string,
    survivedNote: string,
    diedNote: string,
    /**
     * Anybody standing close enough to be hit by one of these, by id.
     *
     * Empty for a crossing, which is why `resolveDescentStrikes` passes
     * nothing: somebody going down through their own hole in the Lid is on
     * their own by definition. A tribulation drawn in a square full of people
     * is a different scene, and this is the whole of the difference.
     */
    bystanders: readonly string[] = [],
    /**
     * Treasures being WIELDED, which will take a strike and come apart doing it.
     *
     * The design owner: *or the tribulation landing on your treasures and
     * blowing them up, right? like you can imagine someone defending with their
     * sword - unless you purposely don't. like you have to be wielding it.*
     *
     * Equipped and not merely carried, which is the whole of what makes this a
     * DECISION rather than a windfall. A sword in the hand is between the bolt
     * and the body and will be destroyed being there; the same sword in the
     * pouch is safe and is not protecting anybody. The player choosing which
     * needs no new verb - `inventory_items.equipped` already says it, and
     * putting a thing away is a thing they can already do.
     *
     * Ordered first against a bystander, because what is in the hand is between
     * the bolt and the body and a person standing nearby is not.
     */
    treasures: readonly string[] = []
): DescentOutcome {
    const perStrike = tribulationStrikeSurvival(cultivator, ambient);

    const injuries: Injury[] = [];
    let struck = 0;

    let weathered = 0;
    const tookItInstead: string[] = [];
    const brokeInstead: string[] = [];
    const unspent = [...treasures];
    for (let strike = 0; strike < strikes; strike++) {
        // WHAT WAS ON THE BODY, FIRST. A treasure is between the bolt and the
        // person; a bystander is beside them. Each one takes a single strike
        // and is gone, so a rack of them is a rack of strikes and no more.
        if (unspent.length > 0) {
            brokeInstead.push(unspent.shift()!);
            continue;
        }
        // SOMEBODY ELSE, WHERE THERE IS SOMEBODY ELSE. Asked first, because a
        // strike that went into a bystander did not arrive here at all, and
        // asking afterwards would be a strike landing twice.
        if (bystanders.length > 0
            && rng.next() < strikesTakenByBystanders(bystanders.length)) {
            tookItInstead.push(
                bystanders[Math.min(bystanders.length - 1,
                    Math.floor(rng.next() * bystanders.length))]!
            );
            continue;
        }
        // AND EACH ONE IS HEAVIER THAN THE LAST. See `EACH_STRIKE_HARDER_BY`.
        const thisOne = Math.max(
            MIN_TRIBULATION_SURVIVAL,
            perStrike - strike * EACH_STRIKE_HARDER_BY
        );
        if (rng.next() < thisOne) { weathered++; continue; }
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
                        `The seam discharged: strike ${strike + 1} of ${strikes}, ${doing}.`
                },
                rng
            ));
        }
    }

    const survived = struck < TRIBULATION_LETHAL_STRIKES;
    const counted = `${struck} of ${strikes} strikes struck home ${doing} `
        + `(${(perStrike * 100).toFixed(0)}% survival per strike).`;
    return {
        strikes,
        struck,
        weathered,
        tookItInstead,
        brokeInstead,
        survived,
        perStrike,
        injuries,
        detail: `${counted} ${survived ? survivedNote : diedNote}`
    };
}

// ENDING A RUN DELIBERATELY

/**
 * Whether this cultivator may end their run by choice rather than by dying.
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
