/**
 * Putting a seal on somebody so they cannot draw.
 *
 * The design owner: *"honestly a seal should be an ability like a soul search,
 * and an effect on the person that had been sealed."*
 *
 * So it is two things and this file is the first of them. The EFFECT lives in
 * `a-qi-seal-is-put-on-a-person.ts` - what a seal does to whoever is carrying
 * one, which is take the ability to draw and nothing else. This is the ACT: who
 * can lay one, on whom, and what happens when the other person does not want it
 * laid.
 *
 * ── BUILT ON THE SHAPE `what-a-soul-search-takes.ts` ALREADY SET ─────────
 *
 * Deliberately the same shape, because it is the same kind of thing: a
 * capability that opens at a realm, aimed at a person, which a strong enough
 * subject can refuse. Everything below has a counterpart there - the realm gate
 * read off the ladder rather than written as a number, the attempt object, the
 * result with a reason on it, and a refusal set whose interesting member is the
 * one that is a CONTEST rather than a bar.
 *
 * Two things are different, and both are about what the acts are for. A soul
 * search TAKES something and is over; a seal LEAVES something and runs. So the
 * result carries a term rather than a haul, and the gap that decides whether it
 * lands also decides how long it holds - one table over one gap, which is how
 * two tables avoid starting to disagree.
 *
 * ── AND IT IS ORDINARY, WHICH IS WHY THE GATE IS LOW ─────────────────────
 *
 * A soul search opens at Nascent Soul because tearing a person open is not
 * ordinary. Sealing is: it is what a house does to its own on a Tuesday, and
 * the elder who does it is an administrator rather than a monster. The gate is
 * Core Formation - high enough that no disciple can seal another disciple in a
 * corridor, low enough that every house in the world has several people who can
 * do it.
 */

import { REALM_TIERS, realmForOrdinal } from '../cultivation/realms.js';
import { OPENS_WITHOUT_FORCING_AT } from './what-a-soul-search-takes.js';
import {
    whatASealLeavesInThePool,
    type AQiSeal
} from '../cultivation/a-qi-seal-is-put-on-a-person.js';

/** The realm the capability opens at. Everybody at or above it has it. */
export const THE_REALM_A_QI_SEAL_OPENS_AT = 'core_formation';

/**
 * The lowest ordinal that can lay one, read off the ladder.
 *
 * Not the literal number: the ladder has been rewritten more than once, and a
 * constant copied out of it is a coincidence maintained by attention. Throws
 * loudly on a renamed tier rather than silently opening the capability to
 * everybody or to nobody - the same reasoning `soulSearchOpensAt` gives.
 */
export function qiSealOpensAt(): number {
    const tier = REALM_TIERS.find(row => row.key === THE_REALM_A_QI_SEAL_OPENS_AT);
    if (!tier) {
        throw new Error(
            `No realm tier is keyed ${THE_REALM_A_QI_SEAL_OPENS_AT}. Sealing is gated on a realm `
            + 'rather than a number, so a renamed tier has to fail loudly here rather than '
            + 'silently opening the capability to everybody or to nobody.'
        );
    }
    return tier.ordinalStart;
}

/** Whether this body can lay a seal at all, which is the whole of the gate. */
export function canLayAQiSeal(ordinal: number): boolean {
    return realmForOrdinal(ordinal).ordinalStart >= qiSealOpensAt();
}

export type WhyNoSealWentOn =
    /** Below Core Formation. Not a failed attempt - not an attempt. */
    | 'below_the_line'
    /** Already sealed. A second seal on one person is not two seals. */
    | 'already_sealed'
    /**
     * Theirs held against yours. The only one of the four that is a contest,
     * and the only one where something actually happened.
     */
    | 'they_held'
    /** Nobody to seal: no subject, or one who is not a going concern. */
    | 'nobody_there';

export interface ASealLaid {
    readonly went: boolean;
    readonly why: WhyNoSealWentOn | null;
    /** The seal itself, or null where none went on. */
    readonly seal: AQiSeal | null;
    /**
     * What their pool is cut to, or null where nothing went on.
     *
     * Taken at once rather than left to leak away: a seal laid on somebody full
     * takes the surplus in the moment it closes, which is the difference
     * between sealing a person and asking them to stop.
     */
    readonly poolCutTo: number | null;
    /** Major realms of gap. Negative when the subject is the stronger. */
    readonly realmGap: number;
    /** Engine truth, one line. Never narration. */
    readonly line: string;
}

export interface ASealAttempt {
    readonly sealerOrdinal: number;
    readonly sealerId: string | null;
    readonly subjectOrdinal: number;
    /** False for somebody dead, gone, or not standing there. */
    readonly subjectIsThere: boolean;
    /** What the subject already carries, so a second seal is not laid. */
    readonly subjectAlreadySealed: boolean;
    /** Absolute world day. */
    readonly onDay: number;
    /** The subject's ceiling, so the seal can take the surplus as it closes. */
    readonly subjectMaxQi: number;
    /**
     * Days the sealer means it to run, or null for one with no end.
     *
     * A REQUEST AND NOT THE ANSWER. What the gap allows is decided below, and a
     * house that says a hundred years over a gap that holds for one is a house
     * that has said something it cannot do.
     */
    readonly forDays: number | null;
    /** Why, in words. Free text. Never a category. */
    readonly note: string;
}

const REALM_STARTS: readonly number[] = REALM_TIERS.map(tier => tier.ordinalStart);

/** Which major realm an ordinal sits in, as a position on the ladder. */
function realmIndexOf(ordinal: number): number {
    const start = realmForOrdinal(ordinal).ordinalStart;
    return REALM_STARTS.filter(row => row <= start).length;
}

/** How many major realms separate two. Positive favours the first. */
function realmsBetween(sealer: number, subject: number): number {
    return realmIndexOf(sealer) - realmIndexOf(subject);
}

/**
 * The gap at which a seal simply goes on.
 *
 * At or above it, nothing is contested because nothing had to be overcome. Below
 * it the subject is close enough to hold, and at zero or worse they hold every
 * time - a person cannot seal their own equal, which is why an elder does this
 * and a senior disciple cannot.
 */
export const A_SEAL_GOES_ON_UNCONTESTED_AT = 2;

/**
 * The longest a seal of a given gap will hold, in days.
 *
 * ONE TABLE OVER ONE GAP. The same number that decides whether it lands decides
 * how long, deliberately: two tables over one gap is how they start disagreeing.
 * A gap of one is a seal that has to be renewed and is the commonest kind a
 * house actually lays; a gap of three or more is a seal nobody in the house can
 * take off but the person who laid it.
 */
export function howLongASealOfThisGapHolds(realmGap: number): number | null {
    if (realmGap <= 0) return 0;
    if (realmGap === 1) return A_YEAR;
    if (realmGap === 2) return A_YEAR * 10;
    // Wide enough that the subject has no say in it at all.
    return null;
}

/** Days in a year, for the terms above. */
const A_YEAR = 365;

/**
 * Whether the seal goes on, and what it is.
 *
 * The engine decides and does not grade. A refusal names which of the four
 * things happened, because a bar and a contest are different facts and somebody
 * who lost a contest learned something a somebody below the line did not.
 */
export function whatLayingASealTakes(attempt: ASealAttempt): ASealLaid {
    const realmGap = realmsBetween(attempt.sealerOrdinal, attempt.subjectOrdinal);
    const nothing = (why: WhyNoSealWentOn, line: string): ASealLaid =>
        ({ went: false, why, seal: null, poolCutTo: null, realmGap, line });

    if (!attempt.subjectIsThere) {
        return nothing('nobody_there', 'No subject present, so nothing was attempted.');
    }
    if (!canLayAQiSeal(attempt.sealerOrdinal)) {
        return nothing(
            'below_the_line',
            `Sealing opens at ordinal ${qiSealOpensAt()} and the sealer stands at `
            + `${attempt.sealerOrdinal}. Not a failed attempt: not an attempt.`
        );
    }
    if (attempt.subjectAlreadySealed) {
        return nothing(
            'already_sealed',
            'They are already carrying one. A second seal on one person is not two seals.'
        );
    }

    const holdsFor = howLongASealOfThisGapHolds(realmGap);
    if (holdsFor === 0) {
        return nothing(
            'they_held',
            `Realm gap ${realmGap}. They held. Below a gap of one there is nothing to overcome `
            + 'them with, and a person cannot seal their own equal.'
        );
    }

    // THE TERM IS THE LESSER OF WHAT WAS ASKED AND WHAT THE GAP ALLOWS. A house
    // that says a hundred years over a gap that holds for one has said
    // something it cannot do, and the engine reports what it can.
    const asked = attempt.forDays;
    const days = holdsFor === null
        ? asked
        : asked === null ? holdsFor : Math.min(asked, holdsFor);
    const liftsOnDay = days === null ? null : attempt.onDay + Math.max(0, Math.floor(days));

    return {
        went: true,
        why: null,
        poolCutTo: whatASealLeavesInThePool(attempt.subjectMaxQi),
        seal: {
            liftsOnDay,
            byId: attempt.sealerId,
            note: attempt.note,
            sinceDay: attempt.onDay
        },
        realmGap,
        line: liftsOnDay === null
            ? `Realm gap ${realmGap}: a seal with no day on it.`
            : `Realm gap ${realmGap}: sealed to day ${liftsOnDay}`
                + (asked !== null && holdsFor !== null && asked > holdsFor
                    ? `, short of the ${asked} asked for, which the gap does not carry.`
                    : '.')
    };
}

// ═════════════════════════════════════════════════════════════════════════
// AND TAKING ONE OFF AGAIN
// ═════════════════════════════════════════════════════════════════════════

/**
 * The two ways a seal comes off.
 *
 * The design owner: *"seals can be removed - 1. by the one who casted it, 2.
 * broken through force of arms by someone significantly stronger than the
 * castor, with odds"*, and *"for 2 reference the soul search table."*
 *
 * There is no third. Nothing lifts on its own that has no day on it, no pill
 * dissolves one, and the subject cannot take their own off however strong they
 * become - which is what makes a seal with no day the thing it is.
 */
export type HowASealComesOff =
    /** The hand that laid it. No contest: it is theirs to close and to open. */
    | 'the_hand_that_laid_it'
    /** Somebody strong enough to break it off them. Contested, with odds. */
    | 'force_of_arms';

export interface BreakingASeal {
    readonly lifted: boolean;
    /**
     * The chance it comes off, 0..1, for the caller to roll against.
     *
     * PURE, like `whatASoulSearchTakes`: state in, odds out, with no roll in
     * here. One is certainty and the caller may skip the roll; zero is a wall
     * and the caller must not roll at all.
     */
    readonly odds: number;
    /** Major realms the breaker stands over THE HAND THAT LAID IT. */
    readonly realmGapOverTheCaster: number;
    /**
     * WHETHER THE HAND THAT LAID IT FINDS OUT, AND IT ALWAYS DOES.
     *
     * The design owner: *"if you break the seal, just as if you broke a
     * formation, the caster knows (see life plates for a similar mechanic)."*
     *
     * A seal is the caster's own work held shut by their own strength, so it
     * going is something that happens TO THEM, wherever they are standing. The
     * genre's jade plate that cracks on a mountain the moment a disciple dies
     * a province away is the same object seen from the other end.
     *
     * True only for a break. A seal the caster lifts themselves is not news to
     * them, and a break that failed is not news to anybody - which is the whole
     * reason somebody would try and fail quietly rather than not try.
     *
     * The value is a FACT and not a write. Who gets told, and through what, is
     * the caller's - this function is pure like the search it is built on.
     */
    readonly theCasterKnows: boolean;
    readonly line: string;
}

/**
 * What breaking a seal takes.
 *
 * ── MEASURED AGAINST THE CASTER, NOT THE PRISONER ────────────────────────
 *
 * The seal is the caster's work and it is the caster's strength holding it
 * shut. Who is inside it has nothing to do with whether somebody else can tear
 * it open - a sealed ascendant and a sealed disciple are behind the same door,
 * and the door is as strong as whoever hung it.
 *
 * That is also why a prisoner cannot free themselves by growing: a seal caps
 * what they can hold at a tenth, so they are not going to out-grow the elder
 * who laid it from inside it. Somebody has to come and do it for them.
 *
 * ── THE TABLE IS THE SOUL SEARCH'S, TURNED INTO ODDS ─────────────────────
 *
 * `howMuchOpens` there walks the same realm gap: nothing at or below zero, a
 * little at one, half at two, everything at three. This is that shape with a
 * probability where the haul was, because a soul search is a reading and this
 * is a fight - the gap says how likely, and the caller rolls it.
 */
export function whatBreakingASealTakes(input: {
    how: HowASealComesOff;
    /** The ordinal of whoever is trying. Ignored for the hand that laid it. */
    breakerOrdinal: number;
    /** The ordinal the seal was laid at. */
    casterOrdinal: number;
    /** True where the breaker IS the caster, which the caller resolves by id. */
    isTheCaster: boolean;
}): BreakingASeal {
    const realmGapOverTheCaster = realmsBetween(input.breakerOrdinal, input.casterOrdinal);

    if (input.how === 'the_hand_that_laid_it') {
        // Theirs to close and theirs to open, and no roll: a house that cannot
        // release its own prisoner has not sealed one, it has lost one.
        if (!input.isTheCaster) {
            return {
                lifted: false,
                odds: 0,
                realmGapOverTheCaster,
                theCasterKnows: false,
                line: 'Not the hand that laid it. Nothing happened.'
            };
        }
        return {
            lifted: true,
            odds: 1,
            realmGapOverTheCaster,
            // Not news to somebody who did it.
            theCasterKnows: false,
            line: 'Lifted by the hand that laid it.'
        };
    }

    const odds = oddsOfBreakingASeal(realmGapOverTheCaster);
    return {
        lifted: odds >= 1,
        odds,
        realmGapOverTheCaster,
        // Anything that can break it tells them it broke. A failed attempt
        // tells nobody, which is why quietly trying is a thing somebody does.
        theCasterKnows: odds > 0,
        line: odds === 0
            ? `Realm gap ${realmGapOverTheCaster} over the caster: nothing to break it with.`
            : `Realm gap ${realmGapOverTheCaster} over the caster: ${Math.round(odds * 100)} in a `
                + 'hundred, and the caller rolls it.'
    };
}

/**
 * The chance force of arms takes a seal off, by realms over the caster.
 *
 * SIGNIFICANTLY STRONGER, which the owner said and which the table says as a
 * shape: an equal cannot touch it at all, one realm up is a long shot worth
 * trying, two is better than even, and three is a wall coming down. The same
 * four steps the soul search walks, because it is the same question - how much
 * more of you is there than of the thing you are pushing against.
 */
export function oddsOfBreakingASeal(realmGapOverTheCaster: number): number {
    if (realmGapOverTheCaster <= 0) return 0;
    // AT OR ABOVE THE SEARCH'S OWN THRESHOLD IT IS NOT A CONTEST. The owner:
    // *"a false immortal would never fail to break a void tribulation seal."*
    // Read off `OPENS_WITHOUT_FORCING_AT` rather than spelled again here - the
    // soul search is the same question about the same ladder, and two
    // constants both spelled 3 is how they start disagreeing.
    if (realmGapOverTheCaster >= OPENS_WITHOUT_FORCING_AT) return 1;
    if (realmGapOverTheCaster === 1) return 0.2;
    return 0.6;
}
