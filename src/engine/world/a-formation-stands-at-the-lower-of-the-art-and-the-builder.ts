/**
 * A formation is a made thing that stands where it was made.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE RULING
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner, on where a formation's rung comes from:
 *
 *   > the strength of a formation is the min of (cultivation technique; you).
 *   > not every technique allows formation building and you can't build a
 *   > formation stronger than you, even if your technique caps out at 44 and
 *   > you're 42, you build 42.
 *
 * So {@link whereAFormationStands} is one `Math.min` and an account of which
 * of the two halves was the binding one. Everything else in this file is the
 * row that number goes onto.
 *
 * ─── WHY THE LOWER AND NOT THE HIGHER ────────────────────────────────────
 *
 * Stated in full because the higher number is the one that LOOKS authoritative
 * - a manual's ceiling is printed in the book and a person's rung is not - and
 * somebody will eventually "fix" this to the art's cap. Three reasons, and the
 * third is the one that matters:
 *
 *   AN ART IS A METHOD, NOT A SOURCE OF FORCE. The qi in a formation is the
 *   builder's. A manual describing work at 44 does not contain 44 rungs of
 *   anything; it describes what somebody standing at 44 would do. Handed to a
 *   42, the two rungs it could have reached are simply not there to put in.
 *
 *   THE OTHER DIRECTION IS ALREADY REFUSED EVERYWHERE. `requiredOrdinal` stops
 *   somebody below an art's floor from working it at all, so the art is never
 *   the smaller number by accident - it is the smaller number when the builder
 *   has climbed past what the book covers, and a 45 working a book that stops
 *   at 30 is doing thirty rungs of work with forty-five rungs of body.
 *
 *   IT IS THE SAME SHAPE AS READING AN OBJECT, and that is not a coincidence.
 *   Realm as capability against worldview as reference: take the lower. A
 *   ceiling and a supply meeting each other yield the smaller, and this world
 *   has two of those now rather than one special case.
 *
 * ─── AND THE `min` IS TAKEN ONCE ─────────────────────────────────────────
 *
 * Raise one at 42, climb to 45, and it is still a 42. `possessions.ts` already
 * states the general rule - *grade is fixed when a thing is made and never
 * moves*, and *crafting creates, it does not promote* - and a formation is an
 * instance of it rather than an exception. There is deliberately NO re-rating
 * function here. The only movement available to it is downward, through
 * `shardPower` when something holes it, which is the movement everything else
 * in the world gets.
 *
 * Two consequences fall out with no code:
 *
 *   A FORMATION IS EVIDENCE OF ITS BUILDER. Its rung cannot exceed the person
 *   who raised it, so a standing array is a FLOOR on what somebody once was. A
 *   thousand-year-old formation at 38 in a ruin says the house that built it
 *   had somebody at 38, whatever the register has forgotten. Nobody authored
 *   that; it is what the `min` means read backwards.
 *
 *   `canUnmake` NEEDS NO SPECIAL CASE. A 42 formation is unmakeable by a force
 *   reaching 42, whoever built it and however long ago. The gate does not ask
 *   where the number came from.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * IT IS AN ORDINARY OBJECT, AND THAT IS THE WHOLE OF THE MECHANICS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A formation is an `ObjectRecord` with a `power`, and every behaviour the
 * ruling asks for already exists and reads that field:
 *
 *   DEFENSIVE, LIKE A SPIRIT BOAT. `sheltering.ts` is `canUnmake` with the
 *   thing in the way, *and not a bonus*. Its header already names *a formation
 *   with a compound behind it* as one of the four cases it covers off the same
 *   field. Nothing new is needed and nothing new is written here.
 *
 *   OFFENSIVE, LIKE A FIXED WEAPON. A weapon is a `power` a resolver reads. The
 *   only thing a formation does differently is that it cannot be carried and
 *   cannot retreat, and neither of those is a combat rule - `possessorId` is
 *   null forever, which is what "cannot be carried" IS in this data model.
 *
 *   IT GETS WEAKER AS IT IS ATTACKED. `object-damage.ts` is that, generically,
 *   for everything: a hole costs a rung through `shardPower`, three holes and
 *   the qi goes out of it. Its own header lists *a formation plate* among the
 *   things it prices, and its input type deliberately cannot see `ObjectKind`,
 *   so a formation-shaped branch is unwriteable there. A formation degrading is
 *   `whatBecomesOfIt`, unmodified.
 *
 * So this file adds no arithmetic about force, no second sheltering rule and no
 * second damage model. It answers one question - what rung does this thing
 * stand at - and mints the row. `FormationStance` below is DATA on the row, and
 * there is nothing in this engine that branches on it; it is there so a
 * narrator can say which one it is looking at.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHO OWNS ONE, AND THE ANSWER IS OFTEN NOBODY
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `ObjectRecord` already carries the distinction and it needed no new field:
 *
 *   `possessorId` is ALWAYS null. Nobody holds a formation. The record's own
 *   comment says null means *in the ground or lost*, and a thing that stands
 *   where it was made is in the ground by definition.
 *
 *   `ownerId` is a sect's when a sect holds the ground and NULL in a ruin whose
 *   builders are a thousand years dead. The record's comment already says null
 *   is *a real answer and often the correct one: nobody's, or nobody living, or
 *   unresolved*, which is exactly a formation still running over a dead house.
 *
 *   `locationId` is where it stands, and it is REQUIRED. That is the one field
 *   a formation cannot do without, because standing somewhere is what it is.
 *
 * A consequence worth naming: `bestObjectHeldBy` in `gatherings.ts` filters on
 * `possessorId`, so a formation can never arm anybody. That is correct rather
 * than a gap - an offensive array is not a sword somebody picked up, it is a
 * thing on the field that has to be fought.
 *
 * PURE. State in, a row out, no mutation of inputs, no I/O, no draws.
 */

import { makeObject, type ObjectRecord, type ObjectSignificance } from './possessions.js';
import { MAX_ORDINAL } from '../cultivation/realms.js';

// ═════════════════════════════════════════════════════════════════════════
// WHICH ARTS RAISE ONE
// ═════════════════════════════════════════════════════════════════════════

/**
 * The value of `Technique.subject` that says an art raises formations.
 *
 * ── THE FIELD EXISTS AND NOTHING WRITES IT ───────────────────────────────
 *
 * `TechniqueSchema.subject` is documented in `schema/cultivation.ts` as *the
 * road this art is on: 'sword', 'formation', 'body'* - this exact string is one
 * of the three examples in the schema's own comment, and `understanding.ts`
 * already pairs `{ domain: 'formation', subject: 'formation' }`. So the column
 * is the right one and it is not being invented here.
 *
 * MEASURED: of 138 technique rows in the catalog, 6 carry a `subject` and all
 * six say `'sword'`. NOT ONE says `'formation'`. So today this predicate is
 * false for every art in the world and nobody can raise anything, which is the
 * honest answer and is left honest deliberately.
 *
 * Two things follow and both are somebody's authoring job rather than code:
 *
 *   The catalog has to say which arts do this. That is a catalog saying what a
 *   technique does, which is the catalog doing its job - it is not an
 *   institutional flag and there is no reason to be shy of it.
 *
 *   NOTHING HERE DEFAULTS TO YES. A permissive fallback would make every art in
 *   the world a formation art the moment somebody called this, which is a much
 *   worse failure than a refusal, and it is the exact shape AGENTS.md warns
 *   about when it says a field nothing writes still reads as a value.
 */
export const FORMATION_ROAD = 'formation';

/**
 * What this file needs to know about an art. `Technique` satisfies it.
 *
 * Structural rather than an import of `Technique`, for the same reason
 * `ThingUnderForce` is structural: a narrow input is a promise about what this
 * module can possibly be reading. It cannot see `element`, `damage`, `mastery`
 * or `grade`, so none of them can quietly become part of the answer.
 */
export interface ArtAsFarAsThisMatters {
    id: string;
    name: string;
    /** The road it is on. {@link FORMATION_ROAD} is the one that counts here. */
    subject: string | null;
    /** The rung it is pitched at. The floor for working it at all. */
    requiredOrdinal: number;
    /** The rung it is written to, or null for an art with no written ceiling. */
    cap: number | null;
}

/**
 * The highest rung of formation this art describes how to build, or null when
 * it does not describe building one at all.
 *
 * `cap` when the book has a ceiling, `requiredOrdinal` when it does not - which
 * is the same reading every other consumer of a manual makes, and not a new
 * opinion about what an art is worth. Note that this is the ART's half of the
 * `min` and never the answer on its own: a caller that uses this figure without
 * {@link whereAFormationStands} has thrown away the builder.
 */
export function whatAnArtCanRaiseTo(art: ArtAsFarAsThisMatters): number | null {
    if (art.subject !== FORMATION_ROAD) return null;
    const reach = art.cap ?? art.requiredOrdinal;
    return clamp(reach);
}

// ═════════════════════════════════════════════════════════════════════════
// THE ONE NUMBER
// ═════════════════════════════════════════════════════════════════════════

/** Which half of the `min` was the binding one. */
export type WhatLimitedIt = 'the art' | 'the builder' | 'neither, they are level';

export interface WhereAFormationStands {
    /** The rung it is raised at. The `min`, and the only number that persists. */
    standsAt: number;
    /** How far the art described. */
    artReachedTo: number;
    /** Where the person raising it stood on the day. */
    builderStoodAt: number;
    limitedBy: WhatLimitedIt;
    /** How many rungs the art could have reached and the builder could not. */
    rungsTheArtHadSpare: number;
    /** Engine-authored, and it names both halves in both directions. */
    account: string;
}

/**
 * What rung a formation raised by this person with this art stands at.
 *
 * THE `min`, AND NOTHING ELSE. No mastery term, no ground term, no quality
 * term, no house term. Each of those would be a third axis nobody ruled on, and
 * the ruling is two axes and a lower-of.
 *
 * Returns null when the art does not raise formations at all, which is a
 * refusal rather than a zero: a formation at rung 0 would be an object standing
 * somewhere that anybody can unmake, and a formation nobody built is not an
 * object at all.
 */
export function whereAFormationStands(input: {
    art: ArtAsFarAsThisMatters;
    builderOrdinal: number;
}): WhereAFormationStands | null {
    const artReachedTo = whatAnArtCanRaiseTo(input.art);
    if (artReachedTo === null) return null;

    const builderStoodAt = clamp(input.builderOrdinal);
    const standsAt = Math.min(artReachedTo, builderStoodAt);
    const spare = Math.max(0, artReachedTo - builderStoodAt);

    const limitedBy: WhatLimitedIt =
        artReachedTo < builderStoodAt ? 'the art'
            : builderStoodAt < artReachedTo ? 'the builder'
                : 'neither, they are level';

    return {
        standsAt,
        artReachedTo,
        builderStoodAt,
        limitedBy,
        rungsTheArtHadSpare: spare,
        account:
            `${input.art.name} describes work to ${artReachedTo} and was laid by somebody standing `
            + `at ${builderStoodAt}, so what is on the ground stands at ${standsAt}. `
            + (limitedBy === 'the art'
                ? 'The book ran out before the hand did. The rungs the builder had over it went '
                  + 'into nothing, because a method is what you know and not what you have.'
                : limitedBy === 'the builder'
                    ? `The ${spare} rung${spare === 1 ? '' : 's'} the book had spare `
                      + 'went nowhere: the qi in a formation is the builder\'s, and a page '
                      + 'describing work above them does not supply any of it.'
                    : 'The book and the hand ran out together, which is the only case where '
                      + 'nothing was wasted.')
    };
}

// ═════════════════════════════════════════════════════════════════════════
// THE ROW
// ═════════════════════════════════════════════════════════════════════════

/**
 * What the formation is FOR, as data on the row.
 *
 * NOTHING IN THE ENGINE BRANCHES ON THIS AND NOTHING MAY. Both stances are the
 * same object with the same `power` read by the same two modules - the
 * difference is which of them a caller reaches for, and that is the caller's
 * situation rather than the formation's property. It is on the row so a
 * narrator can say which one is standing there without guessing.
 */
export type FormationStance = 'defensive' | 'offensive';

export interface RaisingAFormation {
    id: string;
    name: string;
    art: ArtAsFarAsThisMatters;
    builderOrdinal: number;
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
 *
 * The row is an ordinary `makeObject` and the only interesting field on it is
 * `power`. `possessorId` is left null by construction - see the header - and
 * `locationId` carries where it stands, which is the pair of facts that make
 * this a thing that does not move rather than a thing somebody is carrying.
 *
 * `significance` defaults to `notable`, which is `keptAs` TRACKED: a formation
 * has a builder, a day and a rung, and `object-damage.ts` needs a tracked row
 * to write a scar onto. A counted formation could only ever be `held` or
 * `gone`, which throws away the degradation the ruling is about.
 */
export function raiseFormation(input: RaisingAFormation): FormationRaised {
    const stands = whereAFormationStands({
        art: input.art,
        builderOrdinal: input.builderOrdinal
    });

    if (stands === null) {
        return {
            row: null,
            stands: null,
            account:
                `${input.art.name} is not an art that raises formations, so nothing was laid. `
                + 'What a technique does is a fact about the technique, and this one does not '
                + 'say it does this.'
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
 *
 * The query both consumers need - a party arriving at a ruin and a house whose
 * seat is being attacked ask the same question - and it is a filter rather than
 * an index, because `ObjectRecord.locationId` is where the answer already is.
 *
 * Ruined and inert rows are NOT filtered out here. A formation that has been
 * put out is still standing there as masonry and somebody looking at the place
 * should be told about it; `sheltering.ts` and `object-damage.ts` both already
 * refuse to treat a spent row as live, and having the filter in two places is
 * how the two would eventually disagree.
 */
export function formationsStandingAt(
    objects: readonly ObjectRecord[],
    locationId: string
): ObjectRecord[] {
    return objects.filter(o => isFormation(o) && o.locationId === locationId);
}

/**
 * The floor this formation puts under whoever built it.
 *
 * *A formation is evidence of its builder* in one function. Its rung could not
 * have exceeded the person who raised it, so its rung is a lower bound on what
 * they were - and because the rung only ever moves DOWN, a holed formation
 * understates its builder rather than overstating them, which is the safe
 * direction for an inference somebody is going to draw about a dead house.
 *
 * Reads `ratedWhole` where it is there, because that is the number before any
 * holes, and falls back to `power` for a row nothing has touched.
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
