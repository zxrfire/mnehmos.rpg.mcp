/**
 * What a furnace technique does, once it is used.
 *
 * "Furnace" (or "cauldron") is the genre's own word, kept rather than
 * softened: the `subject` of a coerced use, and it names the ROLE, not a
 * person's standing anywhere else. The Crimson Abyss Hall's own disciples
 * know exactly what `crimson-bound-union-rite` is and what being sent to be
 * one means - there is no `deniable` flag on this and there must not be one;
 * the wrong is institutional, not a secret kept from the house that profits
 * by it. What stays hidden, when it does, is from the OUTSIDE - the subject's
 * own house, the ground it happened on - and that is ordinary witness-based
 * concealment, the same as any other deed.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ONE QUESTION THIS FILE ANSWERS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `Technique.furnace` marks an art of `category: 'dual_cultivation'` that only
 * works between two people of different sex - not a preference, a mechanism:
 * the art moves qi through a difference that two people of the same sex do not
 * have between them. `canBeTheTwoParentsOf` in
 * `engine/birth/what-sex-somebody-is-and-what-it-is-for.ts` already asks the
 * identical structural question for parentage, so `worksBetween` is that
 * function under the furnace's own name rather than a second copy of it. One
 * test, read by two callers, is the whole of the design: nothing here invents
 * a rule about who may pair with whom, and nothing here is a gender model -
 * see that file's own header for why the distinction is enforced.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CONSENT IS NOT DECIDED HERE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Whether the subject agreed, or was forced and could not stop it, is settled
 * before this function is ever called - by ordinary agreement between two
 * players, or by a combat resolution that ended in `goal: 'coerce'` reaching
 * `submission` (`engine/cultivation/combat.ts`). That module already owns
 * "was somebody made to" and there must not be a second answer to it living
 * here. `consent` on {@link FurnaceUseInput} is a report of what already
 * happened, not a roll.
 *
 * What THIS file adds is what the trope needs on top of a settled `submission`
 * and that nothing else owns: whether the art could work between these two
 * bodies at all, whether it took, and - because a forced use is a wrong done
 * to a person and not merely a technique that fired - the grudge that opens
 * because of it. The grudge is written with `createGrudge`'s existing
 * `'violated'` cause and `'unforgivable'` severity, exactly as any other grave
 * wrong to somebody's person is, and once it is on the ledger the ordinary
 * inheritance machinery in `lineage.ts` and `grudges.ts`
 * (`inheritLedgerOnDeath`) is what carries it past the act itself - a child
 * born of it and later recognised as an heir inherits the account the same way
 * any heir inherits any open grudge. No separate "grudge outlives a
 * generation" mechanism had to be built; the trope rides the one that already
 * exists for exactly this reason.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CONCEPTION, AND WHAT IT DELIBERATELY DOES NOT DO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `conceived` is a single roll on a caller-owned stream, matching
 * `rollSpiritRoot`'s convention: the caller passes a `[0,1)` sample rather
 * than an RNG, so this function stays pure and testable at the seed. It does
 * not create a person, a `Birth` record, or a `LineageEdge` - those are the
 * existing birth and lineage layers' jobs, and a child conceived here is
 * conceived exactly as any other child in this world is: as a fact the caller
 * carries forward into `birth.ts` and `lineage.ts` on its own timeline. What
 * this file hands back is only the one bit those layers need to know to start:
 * that this act, between these two people, on this day, is where it began.
 */

import type { Sex } from '../birth/what-sex-somebody-is-and-what-it-is-for.js';
import { canBeTheTwoParentsOf } from '../birth/what-sex-somebody-is-and-what-it-is-for.js';
import type { DayIndex } from '../social/common.js';
import type { ObligationInput } from '../social/grudges.js';

/**
 * Whether a furnace technique could work between two people, on sex alone.
 *
 * Deliberately `canBeTheTwoParentsOf` and not a reimplementation of it: the
 * two questions - "could this art move between them" and "could a child of
 * theirs be of both their blood" - are the same structural fact about a pair,
 * and giving them separate answers would be two sources of truth for one
 * thing this world has already ruled on once.
 */
export const worksBetween: (a: Sex, b: Sex) => boolean = canBeTheTwoParentsOf;

/**
 * How the use came about. Reported, not rolled - see the header.
 *
 * `offered` covers any use both parties agreed to, regardless of what either
 * of them wanted from it. `coerced` is used only once a `submission` has
 * already been reached elsewhere; nothing here checks that it was.
 */
export type FurnaceConsent = 'offered' | 'coerced';

export interface FurnaceUseInput {
    actorId: string;
    actorName: string;
    actorSex: Sex;
    subjectId: string;
    subjectName: string;
    subjectSex: Sex;
    onDay: DayIndex;
    consent: FurnaceConsent;
    /**
     * `[0,1)`. Caller-owned stream, matching `rollSpiritRoot`'s convention -
     * give conception its own named draw so it never shifts anything else
     * pulling from the same generator.
     */
    conceptionSample: number;
    /**
     * `[0,1)`. Its own named draw, exactly as `conceptionSample` is - read
     * only when `consent === 'coerced'`, so a caller resolving a willing use
     * may pass any finite number and it is never touched.
     */
    deathSample: number;
}

/**
 * Base chance a single use conceives, once the art has actually worked.
 *
 * One number, read once, here. A cultivator's own fertility, technique
 * mastery, or anything else that might someday shade this is a future input
 * to this same constant's position, not a second place the odds are computed.
 */
export const FURNACE_CONCEPTION_CHANCE = 0.15;

/**
 * What the actor draws off the subject on a willing use, in days of the
 * ACTOR's own cultivation rate - the unit `accrueProgress`
 * (`engine/cultivation/cultivation.ts`) already takes.
 *
 * A furnace technique is a DRAIN, not a shared practice - see the header. The
 * subject loses the same figure off their own rate; the willing case is
 * willing about who is spent, not about the amount. Large, because the
 * genre's own furnace disciple exists to make somebody else's breakthrough
 * cheap, and a boost too small to matter would not be why anybody agrees to
 * be one.
 */
export const FURNACE_DAYS_STOLEN_WILLING = 60;

/**
 * What the actor draws off a coerced use. More than the willing figure -
 * nothing is being managed for the furnace's sake once consent is gone, so
 * the draw runs to what the actor can take rather than to what the subject
 * can sustain. `meridian-devouring-art`'s premise, run through a different
 * channel, and the reason the Crimson Abyss Hall teaches this rather than
 * merely tolerating it: the tithe is real and it is the reason the rite
 * exists.
 */
export const FURNACE_DAYS_STOLEN_COERCED = 150;

/**
 * Chance a coerced draw kills the furnace outright, once it has happened.
 *
 * Never rolled on a willing use: an actor who wants to use the same furnace
 * twice has a reason to keep them alive that a coerced use does not supply.
 * One number, read once, here - see {@link FURNACE_CONCEPTION_CHANCE}'s own
 * comment for why a single constant is the right size for this.
 */
export const FURNACE_COERCED_DEATH_CHANCE = 0.1;

export interface FurnaceUseResult {
    /** False when the art could not work between these two on sex alone. */
    eligible: boolean;
    /** True when the art actually fired. False whenever `eligible` is false. */
    happened: boolean;
    /** Rolled only when `happened`. Always false otherwise. */
    conceived: boolean;
    /**
     * Days of cultivation this use moves, at the ACTOR's own rate. Zero
     * unless `happened`. The caller passes it to `accrueProgress` twice -
     * once as a gain for the actor, once as a loss (negated) for the subject,
     * both against the actor's rate, because that is whose rate the technique
     * runs at. This file computes only the day figure, never the qi.
     */
    daysStolen: number;
    /**
     * True when the draw killed the subject. Always false on a willing use -
     * see {@link FURNACE_COERCED_DEATH_CHANCE}. The caller runs the ordinary
     * death pipeline (`engine/world/legacy.ts`) when this is true; this file
     * does not touch state and does not remove anybody from the world.
     */
    subjectDied: boolean;
    /**
     * The grudge this use opens, or null.
     *
     * Non-null exactly when `consent === 'coerced'` and `happened`. The
     * caller writes it to the subject's obligation ledger; nothing here
     * touches state. Still written when `subjectDied` - a killing is exactly
     * the case `grudges.ts`' inheritance machinery exists for, and the account
     * simply opens with nobody left alive to hold it in person.
     */
    grudge: ObligationInput | null;
    /** Engine truth, one line. Never narration. */
    line: string;
}

/**
 * Use a furnace technique between two people.
 *
 * Pure: two people and a day in, a decision out. The caller is the one
 * holding the world - it writes the grudge, applies `daysStolen` to both
 * cultivators' progress, runs the death pipeline where `subjectDied`, and
 * decides what a `conceived` result becomes in `birth.ts` and `lineage.ts`.
 */
export function useAFurnaceTechnique(input: FurnaceUseInput): FurnaceUseResult {
    const eligible = worksBetween(input.actorSex, input.subjectSex);
    if (!eligible) {
        return {
            eligible: false,
            happened: false,
            conceived: false,
            daysStolen: 0,
            subjectDied: false,
            grudge: null,
            line: 'The art does not answer between the two of them. Nothing happened.'
        };
    }

    const conceived = input.conceptionSample < FURNACE_CONCEPTION_CHANCE;

    if (input.consent === 'offered') {
        return {
            eligible: true,
            happened: true,
            conceived,
            daysStolen: FURNACE_DAYS_STOLEN_WILLING,
            subjectDied: false,
            grudge: null,
            line: conceived
                ? `${input.subjectName} was the furnace, willingly, and it took.`
                : `${input.subjectName} was the furnace, willingly.`
        };
    }

    const subjectDied = input.deathSample < FURNACE_COERCED_DEATH_CHANCE;

    const grudge: ObligationInput = {
        kind: 'grudge',
        holderId: input.subjectId,
        subjectId: input.actorId,
        cause: 'violated',
        severity: 'unforgivable',
        onDay: input.onDay,
        description: subjectDied
            ? `${input.actorName} used ${input.subjectName} as a furnace by force, and it killed them.`
            : `${input.actorName} used ${input.subjectName} as a furnace by force.`,
        participants: [input.actorId, input.subjectId],
        tags: ['furnace', 'coerced', ...(subjectDied ? ['killed'] : [])]
    };

    return {
        eligible: true,
        happened: true,
        // A furnace who did not survive the draw was not left carrying
        // anything. Conception is a fact about a body that lived past it.
        conceived: subjectDied ? false : conceived,
        daysStolen: FURNACE_DAYS_STOLEN_COERCED,
        subjectDied,
        grudge,
        line: subjectDied
            ? `${input.actorName} forced it on ${input.subjectName}, and it killed them.`
            : conceived
                ? `${input.actorName} forced it on ${input.subjectName}, and it took.`
                : `${input.actorName} forced it on ${input.subjectName}.`
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE OTHER ROAD: THE SAME ART, PRACTISED TOGETHER
// ─────────────────────────────────────────────────────────────────────────

/**
 * A non-furnace dual-cultivation art - `Technique.furnace === false` - is not
 * this file's subject at all in the drain sense: it is a legitimate reason to
 * take a cultivation partner, and the household layer's match system
 * (`engine/household/`) is exactly the "why the two of them are doing this
 * together" this mechanic assumes rather than models. What IS this file's to
 * answer, because it is still the opposite-sex mechanism, is the one
 * eligibility question and the one shared benefit: two people cultivating the
 * SAME art together both draw on the difference between them instead of one
 * of them being made to supply it, and both come away very slightly ahead.
 */
export const PAIRED_CULTIVATION_DAYS_BONUS = 2;

export interface PairedCultivationInput {
    aSex: Sex;
    bSex: Sex;
    /** The art both of them are practising. Must be the same id for both. */
    sharedTechniqueId: string;
}

export interface PairedCultivationResult {
    eligible: boolean;
    /** Days of bonus progress EACH of them gets, at their own rate. Zero if not eligible. */
    daysBonus: number;
    line: string;
}

/**
 * Practise the same art together, and both come away ahead.
 *
 * Pure, and there is no consent question to answer: a shared, mutual benefit
 * is not the case this module exists to police. `sharedTechniqueId` is the
 * caller's own read of "are they cultivating the same manual" - this function
 * does not look either of them up.
 */
export function usePairedCultivation(input: PairedCultivationInput): PairedCultivationResult {
    const eligible = worksBetween(input.aSex, input.bSex);
    if (!eligible) {
        return {
            eligible: false,
            daysBonus: 0,
            line: 'The art does not answer between the two of them. Nothing happened.'
        };
    }
    return {
        eligible: true,
        daysBonus: PAIRED_CULTIVATION_DAYS_BONUS,
        line: 'Practised the same art together, and both came away slightly ahead of where they started.'
    };
}
