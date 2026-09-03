/**
 * How somebody comes to own a thing, as opposed to holding it.
 *
 * The owner's ruling, in `docs/world/things/items.md`. **Possession moves
 * easily. Ownership moves three ways and no others**, and everything else is
 * possession, indefinitely.
 *
 *   LEGITIMATE            bought, given, inherited, granted by a house that had
 *                         it to grant. The register moves because everybody
 *                         agrees it should.
 *   FORCE OF ARMS         taken in a war, kept, not recoverable - and *everyone
 *                         else acknowledges* is the load-bearing half. Might
 *                         makes right only where the might is public and the
 *                         holding survives contest.
 *   NOBODY TO ARGUE WITH  a single thief does not become an owner however long
 *                         they keep it. Somebody at the top of the ladder
 *                         standing over a thing is a different fact, because
 *                         there is nobody to raise the question with.
 *
 * ── WHAT WAS ACTUALLY MISSING, AND IT WAS NOT THE THIRD ROUTE ────────────
 *
 * `possessions.ts` has carried the whole claim layer since it was written -
 * `assertClaim`, `withdrawClaim`, `acknowledgeClaim`, a `ClaimBasis` with
 * `conquest` on it, `strength` and `acknowledgedByIds` as SEPARATE fields
 * because "a weak claim loudly asserted and a strong claim nobody has heard"
 * are both real - and **nothing in `src/` called any of it.** Ownership moved
 * by a boolean on `transferPossession` and nothing anywhere recorded on what
 * basis, or asked anybody to acknowledge it.
 *
 * So the field the ruling calls load-bearing was written by nothing at all.
 * That is `AGENTS.md`'s "a field nothing writes is the same defect, one size
 * smaller", and it reads as a working feature because `acknowledgedByIds` being
 * empty means "a claim nobody acknowledges", which is a real state.
 *
 * This module is the three routes stated once, so that a caller says which one
 * it is rather than passing a boolean that means all three at once.
 *
 * ── THE THIRD ROUTE IS A RUNG, NOT A FIGHT ───────────────────────────────
 *
 * *"a single person stealing it, i doubt it - unless you're very very strong
 * like a 45."* That is a statement about where somebody stands, not about who
 * would win on the day, so {@link nobodyLeftToArgueWith} compares MAJOR REALMS
 * and nothing else. `HELPLESS_REALM_GAP` is the constant, read in the same unit
 * `assessGap` reads it in and for the same reason: past it, a contest is not a
 * contest. Somebody nobody can contest is somebody there is no question to
 * raise with.
 *
 * It is deliberately not `assessPower`. What a person is worth on a given
 * afternoon moves with their wounds, their ground and what they are carrying,
 * and an ownership that flickered with all of that would be a register nobody
 * could read. The rung is the durable fact.
 *
 * ── AND IT IS A STANDING STATE, WHICH IS WHY THE CLAIM IS KEPT ───────────
 *
 * Ownership by this route is true while it is true. The claim row is what
 * survives - with its basis, its date and the list of who accepted it - so when
 * the holder falls, dies or is finally challenged, the question can be raised
 * again off a record rather than off nothing. `withdrawClaim` is how it ends,
 * and old claims resurfacing is what `possessions.ts` says claims are for.
 *
 * ── WHAT IS NOT HERE ─────────────────────────────────────────────────────
 *
 * Theft. A thief takes possession and that is the whole of what they take;
 * there is no function here for it because `transferPossession` already
 * defaults `transfersOwnership` to false and *taking a thing does not make it
 * yours* is written on it. The absence is the design.
 */

import { REALM_TIERS, realmForOrdinal } from '../cultivation/realms.js';
import { HELPLESS_REALM_GAP } from '../cultivation/combat.js';
import {
    acknowledgeClaim,
    assertClaim,
    transferPossession,
    type ObjectRecord
} from './possessions.js';

// ─────────────────────────────────────────────────────────────────────────
// THE THREE ROUTES
// ─────────────────────────────────────────────────────────────────────────

/**
 * How this holding became an owning, or that it did not.
 *
 * `possession` is not a failure and is by far the commonest answer. It is what
 * a stolen artifact is, and it is what leaves the thread that makes one
 * findable, dangerous to carry, and a claim its owner's descendants inherit.
 */
export type OwnershipRoute =
    | 'legitimate'
    | 'force_of_arms'
    | 'nobody_to_argue_with'
    | 'possession';

/** Whether a route moves the register at all. Three do; the fourth is the rest of the world. */
export function movesTheRegister(route: OwnershipRoute): boolean {
    return route !== 'possession';
}

// ─────────────────────────────────────────────────────────────────────────
// IS THERE ANYBODY TO RAISE IT WITH
// ─────────────────────────────────────────────────────────────────────────

/** Somebody with standing to say the thing is not yours. */
export interface CouldObject {
    id: string;
    name: string;
    /** Where they stand on the ladder. Not what they are worth today - see the banner. */
    realmOrdinal: number;
}

function realmIndexOf(ordinal: number): number {
    const key = realmForOrdinal(ordinal).key;
    return REALM_TIERS.findIndex(tier => tier.key === key);
}

export interface NobodyToArgueWith {
    /** True when every objector is past the gap at which a contest is not one. */
    nobody: boolean;
    /** Those who could still raise it, strongest first. Empty when `nobody`. */
    couldStillObject: CouldObject[];
    /** Engine-authored account, in both directions. */
    because: string;
}

/**
 * Is there anybody left who could raise the question.
 *
 * Every objector is measured against the holder in major realms, and the bar is
 * `HELPLESS_REALM_GAP` - the same gap at which the combat layer stops calling a
 * confrontation a fight. Somebody that far under cannot make it a question; a
 * roomful of them cannot either, which is deliberate and is the ruling's own
 * distinction between a thief and somebody very very strong. **Numbers are not
 * an argument here.** They are in a war, and a war is the OTHER route.
 *
 * An empty objector list is not automatically nobody. It means nobody was
 * named, which a caller can reach by not looking - so the account says which of
 * the two happened and the caller can tell them apart.
 */
export function nobodyLeftToArgueWith(
    holder: { realmOrdinal: number },
    objectors: readonly CouldObject[]
): NobodyToArgueWith {
    const holderIndex = realmIndexOf(holder.realmOrdinal);
    const couldStillObject = objectors
        .filter(who => holderIndex - realmIndexOf(who.realmOrdinal) < HELPLESS_REALM_GAP)
        .sort((a, b) => b.realmOrdinal - a.realmOrdinal);

    if (objectors.length === 0) {
        return {
            nobody: true,
            couldStillObject: [],
            because:
                'Nobody was named who could raise it. That is an absence of objectors rather than '
                + 'a measurement of them, and a caller that did not go looking will get this answer.'
        };
    }
    if (couldStillObject.length === 0) {
        return {
            nobody: true,
            couldStillObject: [],
            because:
                `All ${objectors.length} who could have raised it stand ${HELPLESS_REALM_GAP} major `
                + 'realms or more under the holder, which is the gap at which a contest is not a '
                + 'contest. There is no question to raise with somebody nobody can contest.'
        };
    }
    return {
        nobody: false,
        couldStillObject,
        because:
            `${couldStillObject.length} of ${objectors.length} could still raise it, the nearest `
            + `being ${couldStillObject[0].name} at ordinal ${couldStillObject[0].realmOrdinal} `
            + 'against a holder at ordinal ' + holder.realmOrdinal + '. Holding a thing in front of '
            + 'somebody who can argue about it is possession, however long it goes on.'
    };
}

// ─────────────────────────────────────────────────────────────────────────
// TAKING IT
// ─────────────────────────────────────────────────────────────────────────

export interface TakingInput {
    by: { id: string; name: string };
    onDay: number;
    /** What happened, in the world's own words. Goes on the claim and the chain. */
    source: string;
    note?: string;
    /** Ledger facts anybody investigating it would turn up. */
    evidenceFactIds?: string[];
    /**
     * Who accepts it. `acknowledgedByIds` is the load-bearing half of force of
     * arms - might makes right only where the might is public - so a caller
     * that acknowledges from nobody has asserted a claim and moved nothing.
     */
    acknowledgedBy?: readonly string[];
}

/**
 * Taken in a war, and the world says so.
 *
 * Possession, ownership, a `conquest` claim and its acknowledgements, in that
 * order and in one call, because those four moving separately is how a register
 * and a claim list start disagreeing about the same afternoon.
 *
 * The claim is asserted at full strength deliberately. `strength` is a
 * judgement about how good a claim is, and a house that took a thing off
 * another house in a war it won has the best claim this world recognises short
 * of having made the thing.
 */
export function takenByForceOfArms(object: ObjectRecord, input: TakingInput): ObjectRecord {
    const moved = transferPossession(object, {
        onDay: input.onDay,
        toHolderId: input.by.id,
        toHolderName: input.by.name,
        how: 'looted',
        transfersOwnership: true,
        source: input.source,
        note: input.note ?? ''
    });
    return withClaim(moved, input, 1, 'Taken in a war and held. ' + (input.note ?? ''));
}

/**
 * Standing over it, with nobody in a position to say otherwise.
 *
 * The third route, and the one that is a rung rather than an event. Ownership
 * moves only where {@link nobodyLeftToArgueWith} says there is nobody; where
 * somebody could still raise it, POSSESSION MOVES AND NOTHING ELSE DOES, which
 * is the ruling's own sentence about a thief and is the ordinary outcome.
 *
 * The claim is written either way. A claim nobody acknowledges is still a
 * claim, and it is what the owner's descendants inherit the argument off.
 */
export function takenByStandingOverIt(
    object: ObjectRecord,
    input: TakingInput & { holder: { realmOrdinal: number }; objectors: readonly CouldObject[] }
): { object: ObjectRecord; route: OwnershipRoute; reading: NobodyToArgueWith } {
    const reading = nobodyLeftToArgueWith(input.holder, input.objectors);
    const moved = transferPossession(object, {
        onDay: input.onDay,
        toHolderId: input.by.id,
        toHolderName: input.by.name,
        how: reading.nobody ? 'looted' : 'stolen',
        // The whole of the ruling, in one expression. Everything else is
        // possession, indefinitely.
        transfersOwnership: reading.nobody,
        source: input.source,
        note: input.note ?? reading.because
    });
    return {
        object: withClaim(moved, input, reading.nobody ? 0.8 : 0.3, reading.because),
        route: reading.nobody ? 'nobody_to_argue_with' : 'possession',
        reading
    };
}

/**
 * The claim and its acknowledgements, on whatever just moved.
 *
 * One place, so the two can never be written apart. `assertClaim` mints the row
 * and returns the object; the id it minted is the last one on the list, which
 * is the only handle it hands back.
 */
function withClaim(
    object: ObjectRecord,
    input: TakingInput,
    strength: number,
    note: string
): ObjectRecord {
    const claimed = assertClaim(object, {
        claimantId: input.by.id,
        claimantName: input.by.name,
        basis: 'conquest',
        assertedOnDay: input.onDay,
        strength,
        evidenceFactIds: input.evidenceFactIds ?? [],
        note
    });
    const minted = claimed.claims[claimed.claims.length - 1];
    return (input.acknowledgedBy ?? []).reduce(
        (carrying, byId) => acknowledgeClaim(carrying, minted.id, byId),
        claimed
    );
}
