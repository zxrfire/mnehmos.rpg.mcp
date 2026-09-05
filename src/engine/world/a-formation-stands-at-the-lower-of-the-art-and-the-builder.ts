/**
 * A formation is a made thing that stands where it was made.
 */

import { makeObject, type ObjectRecord, type ObjectSignificance } from './possessions.js';
import { MAX_ORDINAL } from '../cultivation/realms.js';
import { isOnRoad } from '../../schema/cultivation.js';

// ═════════════════════════════════════════════════════════════════════════
// WHICH ARTS RAISE ONE
// ═════════════════════════════════════════════════════════════════════════

/**
 * The road that says an art raises formations.
 */
export const FORMATION_ROAD = 'formation';

/**
 * What this file needs to know about an art. `Technique` satisfies it.
 */
export interface ArtAsFarAsThisMatters {
    id: string;
    name: string;
    /** The roads it is on. {@link FORMATION_ROAD} is the one that counts here. */
    subjects: readonly string[];
    /** The rung it is pitched at. The floor for working it at all. */
    requiredOrdinal: number;
    /** The rung it is written to, or null for an art with no written ceiling. */
    cap: number | null;
}

/**
 * The highest rung of formation this art describes how to build, or null when it
 * does not describe building one at all.
 */
export function whatAnArtCanRaiseTo(art: ArtAsFarAsThisMatters): number | null {
    if (!isOnRoad(art, FORMATION_ROAD)) return null;
    const reach = art.cap ?? art.requiredOrdinal;
    return clamp(reach);
}

// ═════════════════════════════════════════════════════════════════════════
// THE ONE NUMBER
// ═════════════════════════════════════════════════════════════════════════

/**
 * The stretch of ladder one grade of art covers, and the unit imperfect mastery is
 * charged in.
 */
export const A_GRADE_OF_LADDER = 8;

/** Which half of the `min` was the binding one. */
export type WhatLimitedIt = 'the art' | 'the builder' | 'neither, they are level';

export interface WhereAFormationStands {
    /** The rung it is raised at. The only number that persists. */
    standsAt: number;
    /** The `min` before mastery took anything off it. */
    theLowerOfTheTwo: number;
    /** How far the art described. */
    artReachedTo: number;
    /** Where the person raising it stood on the day. */
    builderStoodAt: number;
    limitedBy: WhatLimitedIt;
    /** How many rungs the art could have reached and the builder could not. */
    rungsTheArtHadSpare: number;
    /** How well the builder knew the art, 0..1. */
    mastery: number;
    /** Rungs imperfect mastery cost, off the `min`. Zero at full mastery. */
    rungsMasteryCost: number;
    /** Engine-authored, and it names both halves in both directions. */
    account: string;
}

/**
 * What imperfect mastery costs, in rungs, off the lower of the two.
 */
export function whatImperfectMasteryCosts(input: {
    lowerOfTheTwo: number;
    mastery: number;
}): number {
    const mastery = Math.max(0, Math.min(1, input.mastery));
    const missing = 1 - mastery;
    if (missing <= 0) return 0;
    return Math.round((missing * Math.max(0, input.lowerOfTheTwo)) / A_GRADE_OF_LADDER);
}

/**
 * What rung a formation raised by this person with this art stands at.
 */
export function whereAFormationStands(input: {
    art: ArtAsFarAsThisMatters;
    builderOrdinal: number;
    /**
     * How well the builder knows the art, 0..1. Omitted means fully mastered,
     * which costs nothing - so a caller that does not know about mastery gets
     * the plain `min` and cannot be silently penalised for not asking.
     */
    mastery?: number;
}): WhereAFormationStands | null {
    const artReachedTo = whatAnArtCanRaiseTo(input.art);
    if (artReachedTo === null) return null;

    const mastery = Math.max(0, Math.min(1, input.mastery ?? 1));
    // ── mastery 0 IS A REFUSAL, NOT A FEEBLE FORMATION ────────────────────
    //
    // The catalog's own authoring helper sets every entry to `mastery: 0`
    // because mastery is per-cultivator state - so zero is precisely the state
    // of an art somebody has just been handed and has never practised. They
    // have seen the diagram and done none of the work, and there is no rung of
    // anything to put on the ground. Refusing here rather than returning a rung
    // is also what stops the commonest caller bug - passing a freshly acquired
    // art through - from silently producing a real object.
    if (mastery <= 0) return null;

    const builderStoodAt = clamp(input.builderOrdinal);
    const theLowerOfTheTwo = Math.min(artReachedTo, builderStoodAt);
    const spare = Math.max(0, artReachedTo - builderStoodAt);
    const rungsMasteryCost = whatImperfectMasteryCosts({
        lowerOfTheTwo: theLowerOfTheTwo,
        mastery
    });
    // Only ever subtracts, and never below the bottom of the ladder.
    const standsAt = Math.max(0, theLowerOfTheTwo - rungsMasteryCost);

    const limitedBy: WhatLimitedIt =
        artReachedTo < builderStoodAt ? 'the art'
            : builderStoodAt < artReachedTo ? 'the builder'
                : 'neither, they are level';

    return {
        standsAt,
        theLowerOfTheTwo,
        artReachedTo,
        builderStoodAt,
        limitedBy,
        rungsTheArtHadSpare: spare,
        mastery,
        rungsMasteryCost,
        account:
            `${input.art.name} describes work to ${artReachedTo} and was laid by somebody standing `
            + `at ${builderStoodAt}, so the most that could have gone into the ground is `
            + `${theLowerOfTheTwo}. `
            + (limitedBy === 'the art'
                ? 'The book ran out before the hand did. The rungs the builder had over it went '
                  + 'into nothing, because a method is what you know and not what you have. '
                : limitedBy === 'the builder'
                    ? `The ${spare} rung${spare === 1 ? '' : 's'} the book had spare `
                      + 'went nowhere: the qi in a formation is the builder\'s, and a page '
                      + 'describing work above them does not supply any of it. '
                    : 'The book and the hand ran out together, which is the only case where '
                      + 'nothing was wasted. ')
            + (rungsMasteryCost > 0
                ? `They know it ${Math.round(mastery * 100)}% through, and at this height that `
                  + `costs ${rungsMasteryCost} rung${rungsMasteryCost === 1 ? '' : 's'}: what is `
                  + `standing there is a ${standsAt}. The higher somebody stands the more an `
                  + 'imperfectly held method wastes, because there is more of them to waste.'
                : `They have the art whole, so nothing was lost in the laying and it stands at `
                  + `${standsAt}.`)
    };
}

// ═════════════════════════════════════════════════════════════════════════
// THE ROW
// ═════════════════════════════════════════════════════════════════════════

/**
 * What the formation is FOR, as data on the row.
 */
export type FormationStance = 'defensive' | 'offensive';

export interface RaisingAFormation {
    id: string;
    name: string;
    art: ArtAsFarAsThisMatters;
    builderOrdinal: number;
    /** 0..1. Omitted means whole. Zero is a refusal - see the note in `where`. */
    mastery?: number;
    builderId: string | null;
    builderName: string;
    /** Where it stands. Required: standing somewhere is what a formation is. */
    locationId: string;
    stance: FormationStance;
    onDay: number;
    /**
     * Whose it is, if anybody's. Null for a formation in a ruin whose builders
     * are dead, which is the ordinary case for everything old.
     */
    ownerId?: string | null;
    ownerName?: string;
    description?: string;
    significance?: ObjectSignificance;
}

export interface FormationRaised {
    /** Null when the art does not raise formations. Nothing was made. */
    row: ObjectRecord | null;
    /** The reading, so a caller can show both halves. Null on a refusal. */
    stands: WhereAFormationStands | null;
    /** Engine-authored. On a refusal this is the reason. */
    account: string;
}

/**
 * Raise one.
 */
export function raiseFormation(input: RaisingAFormation): FormationRaised {
    const stands = whereAFormationStands({
        art: input.art,
        builderOrdinal: input.builderOrdinal,
        mastery: input.mastery
    });

    if (stands === null) {
        // Two refusals, and they are different facts about the situation: the
        // art cannot do this at all, or this person has not learned it yet.
        const notARaiser = whatAnArtCanRaiseTo(input.art) === null;
        return {
            row: null,
            stands: null,
            account: notARaiser
                ? `${input.art.name} is not an art that raises formations, so nothing was laid. `
                  + 'What a technique does is a fact about the technique, and this one does not '
                  + 'say it does this.'
                : `${input.builderName} has ${input.art.name} and has never practised it, so `
                  + 'nothing was laid. The diagram is not the work: an art at no mastery is a '
                  + 'thing somebody has been shown, and there is no rung of it to put on the '
                  + 'ground.'
        };
    }

    const row = makeObject({
        id: input.id,
        name: input.name,
        kind: 'formation',
        significance: input.significance ?? 'notable',
        description: input.description
            ?? `A ${input.stance} formation standing at ${stands.standsAt}, laid by `
               + `${input.builderName} out of ${input.art.name}.`,
        // Nobody holds it. This is the whole of "it cannot be carried".
        possessorId: null,
        ownerId: input.ownerId ?? null,
        ownerName: input.ownerName ?? '',
        power: stands.standsAt,
        locationId: input.locationId,
        tags: ['formation', input.stance],
        data: {
            stance: input.stance,
            raisedFromArtId: input.art.id,
            raisedFromArtName: input.art.name,
            artReachedTo: stands.artReachedTo,
            builderStoodAt: stands.builderStoodAt,
            builtAtMastery: stands.mastery,
            rungsMasteryCost: stands.rungsMasteryCost,
            builderId: input.builderId,
            builderName: input.builderName,
            raisedOnDay: input.onDay,
            // The rung it was whole at, in the field `object-damage.ts` reads
            // when it mends one. Written at making rather than on the first
            // hole, so a formation that is holed before anybody looked at it
            // still knows what it was.
            ratedWhole: stands.standsAt
        }
    });

    row.provenance.push({
        onDay: input.onDay,
        holderId: null,
        holderName: input.ownerName || 'nobody',
        // `crafted` is the existing member for a thing that came into
        // existence rather than changing hands, and `possessions.ts` is
        // explicit that crafting CREATES. Raising a formation is that.
        how: 'crafted',
        source: input.builderName,
        previousHolderId: null,
        previousHolderName: null,
        factId: null,
        note: stands.account
    });

    return { row, stands, account: stands.account };
}

// ═════════════════════════════════════════════════════════════════════════
// READING THEM BACK
// ═════════════════════════════════════════════════════════════════════════

/** Whether this row is a formation. The kind, never a tag. */
export function isFormation(object: Pick<ObjectRecord, 'kind'>): boolean {
    return object.kind === 'formation';
}

/** Which stance it was laid in, or null on a row that is not a formation. */
export function stanceOf(
    object: Pick<ObjectRecord, 'kind' | 'data'>
): FormationStance | null {
    if (!isFormation(object)) return null;
    const s = object.data?.stance;
    return s === 'defensive' || s === 'offensive' ? s : null;
}

/**
 * Every formation standing at a place.
 */
export function formationsStandingAt(
    objects: readonly ObjectRecord[],
    locationId: string
): ObjectRecord[] {
    return objects.filter(o => isFormation(o) && o.locationId === locationId);
}

/**
 * The floor this formation puts under whoever built it.
 */
export function whatItsBuilderMustHaveBeen(
    object: Pick<ObjectRecord, 'kind' | 'power' | 'data'>
): number | null {
    if (!isFormation(object)) return null;
    const whole = Number(object.data?.ratedWhole ?? NaN);
    if (Number.isFinite(whole)) return clamp(whole);
    return object.power === null ? null : clamp(object.power);
}

function clamp(ordinal: number): number {
    if (!Number.isFinite(ordinal)) return 0;
    return Math.max(0, Math.min(MAX_ORDINAL, Math.round(ordinal)));
}
