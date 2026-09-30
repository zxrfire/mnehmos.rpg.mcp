/**
 * Bones off a dead body: where a body lies, what it yields, and who holds the
 * taking against the one who took them.
 *
 * Beside the beast harvest (`hunting-a-spirit-beast.ts`) and the estate at death
 * (`estate-at-death.ts`). A body lies where the person fell: a dead person's world
 * row keeps its `locationId`. Below the Immortal realm its bones are graded by
 * the dead person's rung through the call a dead beast's parts are graded by
 * (`gradeOfWhatItYielded`); above it, by how they died ({@link theBoneThisBodyYields}).
 * They come off once.
 */

import { boneItemId, getBone, type Bone } from '../../data/cultivation/bones.js';
import type { SectAlignment } from '../../schema/cultivation.js';
import { FALSE_IMMORTAL_ORDINAL, rankName } from '../cultivation/realms.js';
import { aWitnessSeesThrough } from '../cultivation/regard.js';
import { severityRank, type Severity } from '../social/grudges.js';
import { gradeOfWhatItYielded } from './hunting-a-spirit-beast.js';
import type { NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';
import {
    howMuchAGradeIsWorthTracking,
    isRuined,
    makeObject,
    transferPossession,
    type ObjectRecord
} from './possessions.js';

// ─────────────────────────────────────────────────────────────────────────
// THE BODY
// ─────────────────────────────────────────────────────────────────────────

/** The body's harvest mark remains after its bones change hands or are consumed. */
const THE_BONES_ARE_TAKEN = 'bones-taken';

/** Whether this is a body lying at this place. */
export function aBodyLiesHere(npc: NpcRecord, locationId: string | null): boolean {
    return locationId !== null && npc.status === 'physically_dead' && npc.locationId === locationId;
}

/** Whether the bones are still on the body. */
export function theBonesAreStillThere(npc: NpcRecord): boolean {
    return !npc.tags.includes(THE_BONES_ARE_TAKEN);
}

/**
 * The bone this body yields: one. Below the Immortal realm its grade is the
 * rung's, through the one grade table. From the Immortal realm up it is how
 * they died, owner ruling 2026-09-30: chaos from a death in their tribulation,
 * immortal from any other. Grade and rung are separate scales, and this is the
 * only place the rung chooses between those two.
 */
export function theBoneThisBodyYields(
    npc: Pick<NpcRecord, 'cultivation'>,
    diedInTheirTribulation: boolean
): Bone {
    const grade = npc.cultivation.realmOrdinal >= FALSE_IMMORTAL_ORDINAL
        ? (diedInTheirTribulation ? 'chaos' : 'immortal')
        : gradeOfWhatItYielded(npc.cultivation.realmOrdinal);
    const bone = getBone(boneItemId(grade));
    // Unreachable while `bones.ts` has a row for every grade.
    if (!bone) throw new Error('No bone row for that grade.');
    return bone;
}

/**
 * Whether the death the world recorded for them was a tribulation they called
 * down: the crossing's `death` fact, on the day they died, with strikes on it
 * (`recording-what-a-crossing-did.ts`).
 */
export function theyDiedInTheirTribulation(state: Pick<WorldState, 'history'>, npc: NpcRecord): boolean {
    if (npc.diedOnDay === null) return false;
    const day = Math.floor(npc.diedOnDay);
    return state.history.facts.some(f => f.kind === 'death' && Math.floor(f.day) === day
        && f.actors.some(a => a.id === npc.id && a.role === 'deceased')
        && Number(f.data.tribulationStrikes ?? 0) > 0);
}

/** The bones somebody holds, off whose body: all of them, or one person's. */
export function theBonesHeldBy(
    objects: readonly ObjectRecord[],
    holderId: string,
    deadId: string | null = null
): ObjectRecord[] {
    return objects.filter(row => row.possessorId === holderId && row.kind === 'material'
        && typeof row.data?.deadId === 'string' && (deadId === null || row.data.deadId === deadId)
        && !isRuined(row));
}

/** The body, with its bones gone. */
export function theBonesAreGone(npc: NpcRecord, onDay: number): NpcRecord {
    return { ...npc, tags: [...npc.tags, THE_BONES_ARE_TAKEN], updatedOnDay: onDay };
}

/**
 * A bone as a row with an origin: whose body (`data.deadId`), at what rung,
 * where. Minted at every grade, because remains are somebody's and a counted
 * stack cannot say whose.
 */
export function objectForBones(init: {
    id: string;
    bone: Bone;
    dead: { id: string; name: string; ordinal: number };
    takerId: string;
    takerName: string;
    place: string;
    onDay: number;
}): ObjectRecord {
    const { bone, dead } = init;
    const blank = makeObject({
        id: init.id,
        name: bone.name,
        kind: 'material',
        significance: howMuchAGradeIsWorthTracking(bone.grade),
        description: `Bone off the body of somebody who stood at ${rankName(dead.ordinal)}.`,
        power: null,
        locationId: null,
        tags: ['human_bone', `grade:${bone.grade}`, `source:${dead.id}`],
        data: { materialId: bone.id, deadId: dead.id, deadOrdinal: dead.ordinal, grade: bone.grade, value: bone.value }
    });
    return transferPossession(blank, {
        onDay: init.onDay,
        toHolderId: init.takerId,
        toHolderName: init.takerName,
        how: 'looted',
        transfersOwnership: true,
        source: `Taken off the body of ${dead.name}, at ${init.place}`,
        note: `${dead.name} stood at ${rankName(dead.ordinal)}.`
    });
}

// ─────────────────────────────────────────────────────────────────────────
// WHO SAW IT, AND WHO HOLDS IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Who holds taking human bones against the one who took them, by the house
 * that learns of it.
 *
 * The owner's ruling, kept here and nowhere else: a righteous witness's house
 * holds a grudge, a neutral witness's house a lesser one, and a demonic house
 * takes no offence. The dead person's own house holds it whenever anybody saw
 * it done.
 */
const WHO_HOLDS_TAKING_BONES_AGAINST_YOU: {
    readonly aWitnessHouse: Readonly<Record<SectAlignment, Severity | null>>;
    readonly theirOwnHouse: Severity;
} = {
    aWitnessHouse: { righteous: 'grave', neutral: 'serious', demonic: null },
    theirOwnHouse: 'grave'
};

/** Somebody standing there, as the reading needs them. */
export interface AWitness {
    id: string;
    ordinal: number;
    houseId: string | null;
    /** Their house's alignment; null reads as neutral. */
    alignment: SectAlignment | null;
}

/**
 * Who of these saw it: everybody, or where it was done out of sight, each one
 * the concealment does not hold against (`aWitnessSeesThrough`).
 */
export function whoSawIt<T extends { ordinal: number }>(
    takerOrdinal: number,
    present: readonly T[],
    outOfSight: boolean
): T[] {
    return present.filter(one => !outOfSight || aWitnessSeesThrough(takerOrdinal, one.ordinal));
}

export interface AHouseHoldsIt {
    houseId: string;
    severity: Severity;
    because: 'saw_it' | 'their_dead';
}

/**
 * The houses that hold it, one row each at the heavier of their reasons. A
 * taking nobody saw is held by nobody.
 */
export function whoHoldsItAgainstYou(input: {
    saw: readonly AWitness[];
    theDeadsHouseId: string | null;
}): AHouseHoldsIt[] {
    const table = WHO_HOLDS_TAKING_BONES_AGAINST_YOU;
    const held = new Map<string, AHouseHoldsIt>();
    const hold = (row: AHouseHoldsIt): void => {
        const was = held.get(row.houseId);
        if (!was || severityRank(row.severity) > severityRank(was.severity)) held.set(row.houseId, row);
    };
    for (const witness of input.saw) {
        if (witness.houseId === null) continue;
        const severity = table.aWitnessHouse[witness.alignment ?? 'neutral'];
        if (severity !== null) hold({ houseId: witness.houseId, severity, because: 'saw_it' });
    }
    if (input.saw.length > 0 && input.theDeadsHouseId !== null) {
        hold({ houseId: input.theDeadsHouseId, severity: table.theirOwnHouse, because: 'their_dead' });
    }
    return [...held.values()];
}
