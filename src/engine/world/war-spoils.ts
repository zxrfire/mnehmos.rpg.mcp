/**
 * What a house's things do when its war ends, which is mostly to change hands.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE CORRECTION THIS FILE IS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `war-breakage.ts` was built first and it answers what a war BREAKS. Put on
 * its own it says something false about the world, and the design owner said so
 * in one line:
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
 * fight*, so it is a reading over who is left standing after one - and
 * `resolveMelee` already lists exactly that, by name, along with who fell. A
 * body whose seniors are all on the second list scatters and one whose elders
 * came out of it does not. This file takes the answer as an argument
 * ({@link TheLosingSide.holdsTogether}) rather than inventing a second one.
 * Until something supplies it, `carried off` is machinery with no producer, and
 * that is a gap with an owner rather than a gap nobody noticed.
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
    transferPossession,
    type ObjectRecord
} from './possessions.js';
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
 * `war-breakage.ts`'s: that one takes what somebody carried out of the gate,
 * and this one takes what stayed in. A house's stores were never in the
 * fighting and are exactly what is left to be argued over afterwards, which is
 * the owner's own reading of why nobody brings a dao material to a battle and
 * why one changes hands anyway.
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
    input: { by: { id: string; name: string }; from: { name: string }; war: string; onDay: number }
): ObjectRecord {
    return transferPossession(object, {
        onDay: input.onDay,
        toHolderId: input.by.id,
        toHolderName: input.by.name,
        how: 'looted',
        transfersOwnership: true,
        source: input.war,
        note: `Taken off the ${input.from.name} at the end of ${input.war}. Nothing was done to `
            + 'the thing; what changed is whose it is.'
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
 */
export function carriedOff(
    object: ObjectRecord,
    input: { by: { id: string; name: string }; from: { name: string }; war: string; onDay: number }
): ObjectRecord {
    return transferPossession(object, {
        onDay: input.onDay,
        toHolderId: input.by.id,
        toHolderName: input.by.name,
        how: 'lost',
        transfersOwnership: true,
        source: `the breaking up of the ${input.from.name}`,
        note: `Walked out of the ${input.from.name}'s hold when it broke up at the end of `
            + `${input.war}. Whoever asks after it next will find a name and then nothing.`
    });
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
                by: { id: carrier.id, name: carrier.name },
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
 * Which of two sides lost.
 *
 * ── THE HONEST FLOOR, AND IT HAS AN OWNER ELSEWHERE ──────────────────────
 *
 * Nothing in this engine decides a war's outcome. `war_opened` schedules a
 * settlement and `settleWarsThatAreOver` removes the tags; neither of them ever
 * asks who won, because until spoils existed nothing turned on it.
 *
 * So this is what a house could put out, and nothing else: the highest rung
 * standing under each banner, tie-broken on how many are standing at all. It is
 * `partyOrdinal`'s rule - the strongest person, never an average, because
 * averaging lets a crowd of juniors outweigh somebody they could not touch -
 * read across a whole roster instead of a party.
 *
 * ── AND WHAT REPLACES IT IS ALREADY WRITTEN. RULED BY THE DESIGN OWNER ───
 *
 *   > obviously this can be easily simulated as a group fight, right? not
 *   > bespoke.
 *
 * So who is losing is not a subsystem anybody has to design. A war is two
 * groups fighting, and `resolveMelee` in `engine/cultivation/combat.ts` already
 * resolves a fight between any number of sides made of any number of people.
 * Enter it with a roster on each side and it hands back every question this
 * file and the two above it have been working around:
 *
 *   WHO LOST            `winningSideId`, and `MeleeSideOutcome.defeated`.
 *   HOW BADLY           `strength`, and `fallen` against `standing`, and it is
 *                       a quantity that MOVES as the thing runs rather than a
 *                       verdict stamped at the end.
 *   WHO IS LEFT         `standing` and `withdrawn`, by name. Which is the one
 *                       input the third fate needs - see
 *                       {@link holdsTogetherAsFarAsAnybodyKnows}.
 *
 * Replace this function the day something builds that; it has one caller and
 * nothing else reads it. What it must NOT become is a second answer standing
 * beside the melee's, so delete it rather than keeping it as a fallback.
 *
 * Null when the two are indistinguishable, which is a real answer: a war that
 * neither side lost moves nothing.
 */
export function whoLost(
    state: WorldState,
    a: FactionRecord,
    b: FactionRecord
): { loser: FactionRecord; winner: FactionRecord } | null {
    const priced = (f: FactionRecord) => {
        const roster = state.npcs.filter(n => n.status === 'alive' && n.factionId === f.id);
        let best = -1;
        for (const n of roster) best = Math.max(best, n.cultivation.realmOrdinal);
        return { best, heads: roster.length };
    };
    const pa = priced(a);
    const pb = priced(b);
    if (pa.best !== pb.best) {
        return pa.best < pb.best ? { loser: a, winner: b } : { loser: b, winner: a };
    }
    if (pa.heads !== pb.heads) {
        return pa.heads < pb.heads ? { loser: a, winner: b } : { loser: b, winner: a };
    }
    return null;
}

/**
 * Whether a losing house holds together, as far as anything can currently say.
 *
 * THE OWNER'S WORD IS *TYPICALLY*, so capture is the ordinary ending and this
 * answers true wherever there is anybody left to hold together. What it does
 * NOT do is read who came out of the fighting still standing, which is what
 * would make it sometimes answer false. Grep this function to find the seam; it
 * is the only place the third fate is decided.
 *
 * ── THE INPUT IT WANTS IS `MeleeSideOutcome.standing` ────────────────────
 *
 * Run the war as a group fight - `resolveMelee`, see {@link whoLost} - and the
 * losing side comes back with its survivors listed by name, its fallen listed
 * by name, and whether it was `defeated` at all. Whether a body breaks up is a
 * reading over those survivors and nothing else, and it is a reading somebody
 * can make honestly because the people it is about are named.
 *
 * Note the shape it should keep: this takes a BOOLEAN and should carry on
 * taking one. `settleTheSpoils` has no business knowing how the answer was
 * reached, and the day a melee decides it, what changes is who computes the
 * boolean rather than anything downstream of it.
 *
 * A house with nobody alive in it does not hold together and does not scatter
 * either. It has already ended, and its things are simply there to be taken -
 * which `settleTheSpoils` handles by falling back to capture.
 *
 * ── SO `carried off` HAS NO PRODUCER TODAY, AND HERE IS THE MEASUREMENT ───
 *
 * The two conditions this interim reading can produce are exactly "somebody is
 * alive" and "nobody is", and the second one is also the case in which there is
 * nobody left to carry anything. Eight seeds and five hundred years: 241
 * settlements, 1737 things moved, and NOT ONE object in a private pair of
 * hands. The third fate is machinery with no producer until a reading exists
 * that can say a house with living members still breaks up - which is a reading
 * over a group fight's survivors, and is somebody else's.
 *
 * Recorded here rather than left to be discovered, because a state nothing
 * produces reads exactly like a state that never fires.
 */
export function holdsTogetherAsFarAsAnybodyKnows(
    state: WorldState,
    factionId: string
): boolean {
    return state.npcs.some(n => n.status === 'alive' && n.factionId === factionId);
}

/** Whoever is still alive under this banner. */
function livingMembersOf(state: WorldState, factionId: string): { id: string; name: string }[] {
    return state.npcs
        .filter(n => n.status === 'alive' && n.factionId === factionId)
        .map(n => ({ id: n.id, name: n.name }));
}
