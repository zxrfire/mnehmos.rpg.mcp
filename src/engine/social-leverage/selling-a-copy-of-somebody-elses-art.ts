/**
 * Writing out a house's art and selling the copy.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE RULING THIS IMPLEMENTS, AND WHY IT IS NOT A PROHIBITION
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner, on a disciple selling a copy of their own house's art:
 *
 *   > IF A DISCIPLE HAD THE GALL TO WRITE IT OUT WITHOUT APPROVAL THE SECT
 *   > WOULD EASILY PUNISH THEM - MAYBE CRIPPLE THEIR CULTIVATION SO THEY
 *   > COULDN'T DO IT AGAIN. OR A DAO OATH.
 *
 * Which is `AGENTS.md`'s governing rule in a sentence: do not ban it, price it.
 * Anybody may attempt anything and the answer to *may I* is always *yes, and
 * here is what it costs*. So nothing in this module refuses anything. It says
 * what the act was worth, hands that to the machinery that already decides what
 * a wronged party does, and lets the answer be whatever the two parties'
 * positions make it - including nothing at all.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND THE SECOND RULING, WHICH IS WHAT MAKES IT SELF-LIMITING
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   > HOW WOULD YOU BE ABLE TO COPY THESE SIGNATURE ARTS? YOU'D HAVE TO MASTER
 *   > IT, WHICH WOULD MEAN YOU ARE AT SECT LEADER OR HIGHER - UNLESS YOU HAVE
 *   > 2 PEOPLE AT 44, ONE IS PISSED, LEAVES, COPIES IT, THE SECT CAN DO
 *   > NOTHING.
 *
 * That gate is not here. It is `couldWriteOutACopy` in `world/manuals.ts`,
 * because it is a fact about holding a thing rather than about wronging
 * somebody, and it is what makes this module's output rare instead of routine:
 * an ordinary disciple never reaches this code, not because it turns them away
 * but because they have nothing to sell.
 *
 * The consequence is the good one and it needs no rule of its own. The set of
 * people who CAN leak a house's signature art is the set of people at or near
 * the top of that house, and `what-a-house-does-when-it-catches-you.ts` already
 * answers *"stands where nothing they could do about it would reach"* for
 * exactly those people. A house that knows precisely who did it and can do
 * nothing is a better scene than a crippling, and nobody had to write it: it
 * falls out of the reprisal resolver's second axis meeting the mastery gate.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NOTHING HERE SCORES ANYTHING. IT TRANSLATES ONE SCALE ONTO ANOTHER
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `betrayalOfSelling` has graded this act on four rungs since it was written,
 * and its own prose is the calibration - *awkward, not fatal*, *the betrayal
 * proper*, *unforgivable and permanent*. `whatItWasWorth` grades every deed in
 * the world on four severities, off `cost` and `irreversible`. This file is the
 * one place those two scales meet, and it is a translation table rather than a
 * second opinion: change `betrayalOfSelling` and the weights follow.
 *
 * Pure. No state, no rolls, no I/O.
 */

import type { KnowingStage } from '../social/discovery.js';
import type { Certainty } from '../world/recognising-whose-art-you-just-watched.js';
import type { DayIndex } from '../social/common.js';
import type { ObligationCause } from '../social/grudges.js';
import type { Deed } from './what-a-deed-leaves.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT IT COST THE HOUSE
// ─────────────────────────────────────────────────────────────────────────

/**
 * `betrayalOfSelling`'s rungs, as the fraction of what the house had.
 *
 * `Deed.cost` is relative on purpose - *a hundred stones off a beggar and a
 * hundred off a house treasury are not the same deed* - and what a leak costs a
 * house is a fraction of the only thing a house genuinely owns: the difference
 * between what it holds and what anybody else can get. So the three figures are
 * where each rung sits on that, and `whatItWasWorth` turns them into the four
 * words the ledger keeps.
 *
 * They are chosen to land on the four severities in the order the rungs already
 * describe, WITH `irreversible` ALWAYS TRUE - because that is the fact about
 * this particular wrong. Once an art is out it is out, no house can undo it,
 * and killing the person who sold it does not put it back. So:
 *
 *   rung 1  0.25  + irreversible          -> serious
 *   rung 2  0.50  + irreversible          -> grave
 *   rung 3  0.90  + irreversible + most   -> unforgivable
 *
 * `tests/engine/social-leverage/selling-a-copy-of-somebody-elses-art.test.ts`
 * pins that mapping, because a design decision living only as a number is a
 * design decision nobody can check.
 */
export const WHAT_A_LEAK_COSTS_THE_HOUSE: Readonly<Record<1 | 2 | 3, number>> =
    Object.freeze({ 1: 0.25, 2: 0.5, 3: 0.9 });

/**
 * The ledger's own word for it, which differs by whose art it was.
 *
 * `grudges.ts` is explicit that nothing branches on a cause and that the list is
 * data, so these are handles for a reader in forty years rather than inputs to
 * anything. They differ because the two acts genuinely are different: selling a
 * house's art while wearing its colours is `betrayal` in the plain sense, and
 * selling somebody else's is taking the one thing they have that other people
 * do not.
 */
export function theLedgersWordForALeak(rung: 1 | 2 | 3, sellerIsOfTheHouse: boolean): ObligationCause {
    return sellerIsOfTheHouse || rung === 3 ? 'betrayal' : 'robbery';
}

// ─────────────────────────────────────────────────────────────────────────
// WHO WORKED IT OUT
// ─────────────────────────────────────────────────────────────────────────

/**
 * How far a house gets on the ladder of knowing, from what one person standing
 * there was able to make of the thing that changed hands.
 *
 * THERE IS NO WITNESS SYSTEM HERE AND THERE MUST NOT BE ONE. `KnowingStage` is
 * the ladder, `canPointAt` is the rung at which a record can be opened against
 * somebody, and `whatTheirReferenceAffords` in
 * `recognising-whose-art-you-just-watched.ts` already calibrates how much of an
 * answer a given reference is worth. This is the one line joining them:
 *
 *   certain      `placed`. Somebody can put a name to it and go to the house.
 *   consistent   `named`. A word gets back, and it will not carry a reprisal.
 *   anything else nothing. They watched a stranger hand over paper.
 *
 * `consistent` stopping short of `placed` is the load-bearing part. A house does
 * not cripple somebody on the word of a person who has admitted they could not
 * tell a forgery, and the resolver reads `canPointAt` rather than "was anybody
 * standing there" precisely so that the difference is expressible.
 *
 * ── AND ONLY THE REFERENCE AXIS, WHICH IS NOT AN OVERSIGHT ───────────────
 *
 * `whereThisArtWasLearned` reads two axes and takes the lower: a RUNG, for
 * whether the observer can follow what is being done, and a REFERENCE, for
 * whether they hold any idea of what that house's work looks like. The first
 * one is about a demonstration and there is no demonstration here. A copy is
 * paper - the house's own method, in a hand somebody could compare - and a
 * junior of that house recognises the book they were taught out of without
 * being able to perform a single line of it.
 *
 * Measured, and it is why this is written down: reading the perceptual axis
 * against the seller's rung made every disciple of the Azure Cloud Pavilion
 * standing in the square unable to recognise their own house's manual, because
 * they stood two realms below the person selling it. That is a true statement
 * about watching somebody fight and a false one about looking at a book.
 */
export function theStageAWitnessReaches(reference: Certainty): KnowingStage {
    if (reference === 'certain') return 'placed';
    if (reference === 'consistent') return 'named';
    return 'unaware';
}

// ─────────────────────────────────────────────────────────────────────────
// THE DEED
// ─────────────────────────────────────────────────────────────────────────

export interface ALeak {
    /** `betrayalOfSelling`'s rung. 0 is nobody's art and opens nothing. */
    rung: 0 | 1 | 2 | 3;
    /** The house whose art it was, or null when it is nobody's. */
    ownerFactionId: string | null;
    /** True when the seller wears that house's colours. */
    sellerIsOfTheHouse: boolean;
    sellerName: string;
    artName: string;
    /** What they were paid, for the record. Never a weight. */
    stones: number;
    onDay: DayIndex;
    /**
     * Everybody who got far enough up the ladder of knowing to name it.
     *
     * Faction ids and person ids both, exactly as `Deed.knownTo` takes them.
     * EMPTY IS THE INTERESTING CASE and it is not an error: a deed nobody
     * worked out opens no account, because a record is held against a name and
     * there is nobody to hold one.
     */
    knownTo: readonly string[];
    /** How many people were standing there at all. A tag, never a weight. */
    witnesses: number;
}

/**
 * The leak, as an ordinary deed the ordinary machinery prices.
 *
 * Null at rung 0, which is not a softening: an art four houses teach is nobody's
 * and selling a copy of it is a living rather than a wrong. Everything above
 * that comes back as a deed and goes to `whatTheHouseDoesAboutIt` unchanged - no
 * second resolver, no branch on which house, no rule that applies to one faction.
 */
export function theLeakAsADeed(leak: ALeak): Deed | null {
    if (leak.rung === 0 || leak.ownerFactionId === null) return null;
    return {
        cause: theLedgersWordForALeak(leak.rung, leak.sellerIsOfTheHouse),
        // The house paid. `paidBy: 'subject'` is the direction the ledger uses
        // for a wrong done TO the party the record is about, and the reprisal
        // that follows will be a separate deed with the direction reversed.
        paidBy: 'subject',
        cost: WHAT_A_LEAK_COSTS_THE_HOUSE[leak.rung],
        // ALWAYS. Once it is out it is out, and no amount of anything puts it
        // back - which is the one fact about this wrong that separates it from
        // every theft in the world.
        irreversible: true,
        // A member gave a word when they took the colours. Somebody who never
        // did has broken no promise, whatever else they have done.
        ...(leak.sellerIsOfTheHouse ? { promised: true } : {}),
        onDay: leak.onDay,
        description:
            `${leak.sellerName} wrote out a copy of ${leak.artName} and sold it for `
            + `${leak.stones} spirit stone${leak.stones === 1 ? '' : 's'}.`,
        knownTo: leak.knownTo,
        witnesses: leak.witnesses,
        participants: [leak.ownerFactionId],
        tags: [
            'leaked_an_art',
            `rung:${leak.rung}`,
            ...(leak.sellerIsOfTheHouse ? ['their_own_house'] : [])
        ]
    };
}
