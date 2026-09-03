/**
 * What a house's things do when its war ends, which is mostly to change hands.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE CORRECTION THIS FILE IS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * What a war BREAKS was built first, and put on its own it says something false
 * about the world. The design owner said so in one line:
 *
 *   > why would anyone bring a single use dao material in a war? those are all
 *   > in vaults (which may be destroyed accidentally) but are typically left as
 *   > spoils of war.
 *
 * TYPICALLY LEFT AS SPOILS. So the ordinary fate of what a house holds when it
 * loses is not that it is smashed - it is that somebody else has it. A world
 * where every war destroys is a world that runs out of things, and the eight
 * seed soak that raised the worry was measuring a model with only one ending
 * in it.
 *
 * That also resolves the depletion question honestly rather than by tuning:
 * capture MOVES a thing. Five thousand years of wars redistribute the world's
 * dao materials instead of consuming them, and the top of the ladder does not
 * thin because nobody destroyed anything.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NOTHING HERE IS A NEW MECHANIC
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A captured thing is `transferPossession` with a new holder and a link in the
 * chain saying which war took it - the same function `immortal-world.ts`,
 * `legacy.ts` and the barter tier already use, with `transfersOwnership`,
 * because a house that lost a thing does not still own it.
 *
 * And the chain is the whole point rather than the bookkeeping. An object that
 * changed hands in a war is an object with a provenance link naming the war,
 * the day, the house it came off and the house that took it - so somebody two
 * centuries later can be asked about it, a descendant can recognise it, and a
 * claim can be asserted on it. `possessions.ts` has carried all four of those
 * since it was written and none of them needed anything here.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT IS IN A VAULT IS BEHIND THE VAULT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The second fate. A vault is a rated thing with things behind it, so
 * `sheltering.ts` answers it with no new code: what a vault holds is reached
 * only by a force that could get through the vault, and a vault that is unmade
 * takes what was in it. That is the boat reading with the roles swapped, and it
 * is the same call.
 *
 * ── WHY IT IS NOT WIRED YET, SAID OUT LOUD ───────────────────────────────
 *
 * NO WORLD CONTAINS A VAULT OBJECT. A house's stores sit on rows whose
 * `possessorId` is the house itself and whose `locationId` is its seat, and
 * there is no rated row standing between them and the world. So
 * {@link whatABreachedVaultTakesWithIt} is built and tested and reaches nothing
 * in play, which is stated here rather than left to be discovered: what is
 * missing is a rated row for a house's hold, not a function.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE THIRD FATE, AND THE ONE INPUT THIS FILE DOES NOT DERIVE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner's third ending:
 *
 *   > or the losing side grabs their vault and runs and disbands
 *
 * Which is the most interesting of the three and the cheapest, because it is
 * not a mechanic either: it is transfers to INDIVIDUALS rather than to a house,
 * plus the house going away. An object that leaves a vault in somebody's arms
 * and never lands on another roll is exactly the shape of a tracked thing in
 * private hands with a gap in its chain, which is most of what makes an
 * artifact worth chasing. Compare capture, where the chain stays clean and the
 * thing is simply somewhere else.
 *
 * And it is what twelve sealed compounds in the live world are already saying -
 * every one of them reads *the seat of a power that no longer exists*, and
 * nothing in the engine produces that.
 *
 * WHETHER A HOUSE BREAKS UP IS NOT DECIDED HERE AND THERE IS NO `willFlee`
 * FIELD. Ruled by the design owner, a war *can be easily simulated as a group
 * fight*, so it is a reading over who is left standing after one. `war-melee.ts`
 * makes it: a house holds together while somebody it was led by when the war
 * opened is still alive in it, and one whose seniors are all on the fallen list
 * scatters. This file takes the answer as an argument
 * ({@link TheLosingSide.holdsTogether}) rather than forming a second one.
 *
 * ── AND DISBANDING IS NOT BEING DESTROYED ────────────────────────────────
 *
 * The difference is what happens to the people, and it is the whole value of
 * the outcome. Members SCATTER - alive, with their ties, their grudges and what
 * they know intact, and some of them carrying the vault. Nobody is deleted.
 * That is what makes the objects findable later rather than gone, and it is a
 * far better source of events than a house being removed from the table.
 *
 * PURE where it can be. `settleTheSpoils` mutates `state` because it is a
 * world pass; everything under it is state in, deltas out.
 */

import type { CultivationRNG } from '../cultivation/rng.js';
import type { HistoricalFact } from './history.js';
import {
    isInert,
    type ForceApplied,
    type ThingUnderForce
} from './object-damage.js';
import {
    isRuined,
    type ObjectRecord
} from './possessions.js';
import {
    takenByForceOfArms,
    takenByStandingOverIt,
    type CouldObject
} from './ownership-transfer.js';
import { whatIsBehindIt, type WhatIsBehindIt } from './sheltering.js';
import type { FactionRecord, WorldState } from './world-state.js';

// ═════════════════════════════════════════════════════════════════════════
// THE THREE ENDS
// ═════════════════════════════════════════════════════════════════════════

/**
 * What became of one thing when the war it was behind came to an end.
 *
 * Three, and the ordinary one is the first. None of them is a kind of object.
 */
export type Fate =
    /** Somebody else has it, and the chain says who took it and in what war. */
    | 'taken'
    /** It was behind something that came apart, and it went with it. */
    | 'lost with the vault'
    /** Somebody walked away with it, and the house they walked away from is gone. */
    | 'carried off';

export interface TheLosingSide {
    id: string;
    name: string;
    /**
     * Whether the body holds together when it loses.
     *
     * NOT DERIVED HERE, deliberately, and there is no default: it is a reading
     * of the roster's own leadership and it has an owner elsewhere. See the
     * header. Required rather than optional so that nothing can quietly get the
     * common case by forgetting to answer.
     */
    holdsTogether: boolean;
}

export interface ThingChangedHands {
    objectId: string;
    objectName: string;
    fate: Fate;
    /** The house it came off. */
    fromId: string;
    fromName: string;
    /** Who has it now: a house for `taken`, a person for `carried off`. */
    toId: string | null;
    toName: string;
    /** The rung it stands at. Unchanged - capture is not damage. */
    ratedAt: number | null;
    line: string;
}

// ═════════════════════════════════════════════════════════════════════════
// WHAT A LOSING SIDE STILL HOLDS
// ═════════════════════════════════════════════════════════════════════════

/**
 * The things a house has left that a settlement can move.
 *
 * ONE PREDICATE AND IT NAMES NO KIND, and note that it is the COMPLEMENT of
 * what the fighting reaches: a melee breaks what the people in it carried out
 * of the gate, and this takes what stayed in. A house's stores were never in
 * the fighting and are exactly what is left to be argued over afterwards, which
 * is the owner's own reading of why nobody brings a dao material to a battle
 * and why one changes hands anyway.
 *
 * Anything already ended or emptied is skipped: a settlement moves what is
 * there, and a ruined row is a record rather than a thing.
 */
export function whatIsLeftInTheHold(state: WorldState, factionId: string): ObjectRecord[] {
    return state.objects.filter(o =>
        o.ownerId === factionId
        && o.possessorId === factionId
        && !isRuined(o)
        && !isInert(o)
    );
}

// ═════════════════════════════════════════════════════════════════════════
// TAKEN
// ═════════════════════════════════════════════════════════════════════════

/**
 * The winner has it.
 *
 * `transfersOwnership` because a house that lost a thing does not still own it,
 * and the link names the war rather than the day's weather, so the chain reads
 * as an account of where this came from two centuries later.
 *
 * `possessorId` becomes the taking HOUSE and not a person, which puts the thing
 * straight into that house's own hold - so it is out of the fighting again on
 * the next war and can be taken again on the one after. Things move around this
 * world by being lost, which is most of how an old object accumulates a chain.
 */
export function takenAsSpoils(
    object: ObjectRecord,
    input: {
        by: { id: string; name: string };
        from: { id: string; name: string };
        war: string;
        onDay: number;
    }
): ObjectRecord {
    return takenByForceOfArms(object, {
        by: input.by,
        onDay: input.onDay,
        source: input.war,
        note: `Taken off the ${input.from.name} at the end of ${input.war}. Nothing was done to `
            + 'the thing; what changed is whose it is.',
        // THE LOAD-BEARING HALF. `items.md`: force of arms moves the register
        // only where everyone else acknowledges it, and the party whose
        // acknowledgement means anything is the house that lost. A house that
        // cannot take a thing back has lost the thing rather than the use of
        // it, and this is where that is written down instead of assumed.
        acknowledgedBy: [input.from.id]
    });
}

// ═════════════════════════════════════════════════════════════════════════
// CARRIED OFF
// ═════════════════════════════════════════════════════════════════════════

/**
 * Somebody walked out with it, and the house they walked out of is gone.
 *
 * The one difference from capture that matters, and it is not in the mechanism:
 * the holder is a PERSON. A house that has a thing is on a roll somebody can
 * read; a person who has one is not, so the object's chain ends at a name and
 * then stops, which is a gap in a provenance and is exactly the shape of every
 * object in this world that is worth chasing.
 *
 * The person is not deleted and neither is anybody else. `dissolvedOnDay` on
 * the house is the whole of what ends; the people scatter with their ties,
 * their grudges and what they know, and one of them is carrying this.
 *
 * ── AND WHETHER IT BECOMES THEIRS IS THE THIRD ROUTE ─────────────────────
 *
 * This used to move ownership unconditionally, and `items.md` has since ruled
 * that it cannot: **a single person does not become an owner by walking out
 * with something**, however long they keep it, and that is what leaves a stolen
 * thing findable and dangerous to carry. What decides it is whether anybody who
 * scattered with them is in a position to raise the question -
 * `nobodyLeftToArgueWith` in `ownership-transfer.ts`, which is a rung and not a
 * fight.
 *
 * So the commonest outcome here is now POSSESSION: an ordinary member walks out
 * with the hold's best thing and their seniors, also scattered, also alive,
 * know exactly what they took. The route only completes for somebody standing
 * far enough above every one of them that there is no question to raise. Both
 * write a claim, because a claim nobody acknowledges is still a claim and it is
 * what somebody's descendants inherit the argument off.
 */
export function carriedOff(
    object: ObjectRecord,
    input: {
        by: { id: string; name: string; realmOrdinal: number };
        from: { name: string };
        /** Who else walked out of the same house and could say whose it is. */
        objectors: readonly CouldObject[];
        war: string;
        onDay: number;
    }
): ObjectRecord {
    return takenByStandingOverIt(object, {
        by: input.by,
        onDay: input.onDay,
        holder: { realmOrdinal: input.by.realmOrdinal },
        objectors: input.objectors,
        source: `the breaking up of the ${input.from.name}`,
        note: `Walked out of the ${input.from.name}'s hold when it broke up at the end of `
            + `${input.war}. Whoever asks after it next will find a name and then nothing.`
    }).object;
}

// ═════════════════════════════════════════════════════════════════════════
// LOST WITH THE VAULT
// ═════════════════════════════════════════════════════════════════════════

/**
 * What a breached hold takes down with it.
 *
 * The shelter reading with the roles swapped, and it computes nothing: a vault
 * is a rated thing, what it holds is behind it, and `whatIsBehindIt` already
 * says that a force which cannot get through the one does not reach the others.
 * A vault standing at 29 keeps everything in it out of reach of everybody under
 * 29, categorically, for the same reason a hull keeps its passengers.
 *
 * Reports only. What the caller does with `reached` is the caller's - they are
 * ordinary objects and `whatBecomesOfIt` is what happens to them next.
 */
export function whatABreachedVaultTakesWithIt(
    vault: ThingUnderForce,
    force: Pick<ForceApplied, 'ordinal' | 'byName'>,
    inside: readonly ObjectRecord[]
): WhatIsBehindIt<ObjectRecord> {
    return whatIsBehindIt(vault, force, inside);
}

// ═════════════════════════════════════════════════════════════════════════
// THE SETTLEMENT
// ═════════════════════════════════════════════════════════════════════════

export interface SpoilsInput {
    loser: TheLosingSide;
    winner: FactionRecord;
    war: string;
    onDay: number;
    /** For the record, when the caller has one. */
    fact?: HistoricalFact | null;
}

/**
 * Move what the losing side held.
 *
 * Everything in the hold, not a sample. A war's ending is one event and the
 * hold is emptied once; drawing a subset would be a second rate constant
 * deciding how much of a defeat a defeat is, and the defeat already decided
 * that.
 *
 * Which of the three fates applies is read off `holdsTogether` and nothing
 * else. A house that holds together has lost its things; a house that does not
 * has lost itself, and its things went out of the door in its members' arms.
 */
export function settleTheSpoils(
    state: WorldState,
    input: SpoilsInput,
    rng: CultivationRNG
): ThingChangedHands[] {
    const hold = whatIsLeftInTheHold(state, input.loser.id);
    if (hold.length === 0) return [];

    const scattering = !input.loser.holdsTogether;
    const survivors = scattering ? livingMembersOf(state, input.loser.id) : [];
    // A house with nobody left cannot carry anything out of anywhere. Falls
    // back to capture rather than to nothing, because the things are still
    // there and somebody won.
    const canScatter = scattering && survivors.length > 0;

    const out: ThingChangedHands[] = [];
    for (const object of hold) {
        const at = state.objects.findIndex(o => o.id === object.id);
        if (at < 0) continue;

        if (canScatter) {
            const carrier = survivors[rng.int(0, survivors.length - 1)];
            state.objects[at] = carriedOff(object, {
                by: carrier,
                // Everybody else who walked out of the same door. They know what
                // the hold contained and they know who left with it, which is
                // the whole of what standing to raise it means here.
                objectors: survivors.filter(other => other.id !== carrier.id),
                from: input.loser,
                war: input.war,
                onDay: input.onDay
            });
            out.push({
                objectId: object.id,
                objectName: object.name,
                fate: 'carried off',
                fromId: input.loser.id,
                fromName: input.loser.name,
                toId: carrier.id,
                toName: carrier.name,
                ratedAt: object.power,
                line: `${carrier.name} walked out of the ${input.loser.name} with ${object.name}.`
            });
            continue;
        }

        state.objects[at] = takenAsSpoils(object, {
            by: { id: input.winner.id, name: input.winner.name },
            from: input.loser,
            war: input.war,
            onDay: input.onDay
        });
        out.push({
            objectId: object.id,
            objectName: object.name,
            fate: 'taken',
            fromId: input.loser.id,
            fromName: input.loser.name,
            toId: input.winner.id,
            toName: input.winner.name,
            ratedAt: object.power,
            line: `The ${input.winner.name} took ${object.name} off the ${input.loser.name}.`
        });
    }

    // The house going away is the other half of scattering, and it is one
    // field. The people are untouched: they keep their ties, their accounts and
    // what they know, and they are now nobody's.
    if (canScatter) {
        const row = state.factions.find(f => f.id === input.loser.id);
        if (row && row.dissolvedOnDay === null) {
            row.dissolvedOnDay = input.onDay;
            for (const npc of state.npcs) {
                if (npc.factionId === input.loser.id) npc.factionId = null;
            }
        }
    }

    return out;
}

/**
 * Whether there is anybody left under this banner at all.
 *
 * ── ONE HALF OF THE ANSWER, AND DELIBERATELY NOT THE WHOLE OF IT ─────────
 *
 * A house with nobody alive in it does not hold together and does not scatter
 * either. It has already ended, and its things are simply there to be taken -
 * which `settleTheSpoils` handles by falling back to capture.
 *
 * The OTHER half, which is what makes the answer sometimes false for a house
 * that still has people, is `HowAHouseIsFaring.ledStill` in `war-melee.ts`: the
 * war took everybody the house was led by, so it has living members and nobody
 * senior enough to hold them. `settleOneWar` there is the caller, and it ands
 * the two together.
 *
 * Note the shape this file keeps. {@link TheLosingSide.holdsTogether} is a
 * BOOLEAN and stays one: `settleTheSpoils` has no business knowing how the
 * answer was reached, and when the reading changed, what changed was who
 * computes it rather than anything downstream.
 */
export function holdsTogetherAsFarAsAnybodyKnows(
    state: WorldState,
    factionId: string
): boolean {
    return state.npcs.some(n => n.status === 'alive' && n.factionId === factionId);
}

/** Whoever is still alive under this banner. */
function livingMembersOf(state: WorldState, factionId: string): CouldObject[] {
    // The rung comes along because whoever ends up carrying something out
    // has to be measured against everybody who did not - see `carriedOff`.
    return state.npcs
        .filter(n => n.status === 'alive' && n.factionId === factionId)
        .map(n => ({ id: n.id, name: n.name, realmOrdinal: n.cultivation.realmOrdinal }));
}
