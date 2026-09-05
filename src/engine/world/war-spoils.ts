/**
 * What a house's things do when its war ends, which is mostly to change hands.
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
