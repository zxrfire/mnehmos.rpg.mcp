/**
 * Recognising a thing somebody is carrying.
 *
 * The owner's ruling, in `docs/world/things/items.md`: **an artifact with a
 * name is known the way a technique with a name is known** - by people who have
 * reason to know it, to the degree they have reason. So this is deliberately
 * not a new system. It is `recognising-whose-art-you-just-watched.ts` pointed at
 * an object, and it imports that module's two axes rather than restating them:
 * a second scale for how well somebody can tell one thing from another is two
 * answers to one question, and the softer one would win somewhere.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE TWO AXES, THE SAME TWO
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   REALM is capability.   How much of the thing they can make out. `power` is
 *                          on the same ladder a person stands on - the artifact
 *                          catalog's first design claim - so the gap between a
 *                          reader and a rated object is the same subtraction,
 *                          in the same unit, that the art check makes against a
 *                          performance.
 *   WORLDVIEW is reference. Whether they hold any idea of what the thing is
 *                          supposed to be. `KnowingStage`, held against the
 *                          HOUSE it belongs to, because a famous object is
 *                          famous as SOMEBODY'S.
 *
 * The IDENTIFICATION is the lower of the two, as it is for an art, and for the
 * same reason: neither axis rescues the other, and a reader short on either
 * gets an honestly hedged answer rather than a confident wrong one.
 *
 * ── AND THE TWO AXES DO NOT FAIL THE SAME WAY ────────────────────────────
 *
 * Ruled by the design owner: *"being unable to read something is itself a
 * sign."* No reference fails blank - nothing is felt, so nothing is reported.
 * A realm gap does not: THE GAP IS THE SIGNAL, and it gets louder the wider it
 * is. Somebody far under an object cannot name it, cannot place it and cannot
 * be told a thing about its provenance, and knows with no hedging at all that
 * it is beyond them.
 *
 * So `outOfTheirDepth` is reported ALONGSIDE the identification and never
 * folded into it - at the far end the two run in opposite directions. It is
 * `whatTheGapItselfTells` next door rather than a second scale here, because a
 * second scale is the exact thing this file was written not to grow: an art
 * performed far above somebody has to answer the same way, and it does.
 *
 * That is what produces the unevenness the ruling is about. A village carter
 * does not know the Standing Edge from any other sword - no reference, and no
 * rung either. The house that lost it knows it across a courtyard, because
 * their reference for themselves is `known`.
 *
 * ── WHAT IS DIFFERENT FROM THE ART CHECK, AND WHY ────────────────────────
 *
 * AN OBJECT HAS A RECORD OF ITS OWN AND AN ART DOES NOT. `whoseArt` answers off
 * a catalog: which houses teach it, the same answer for everybody. An object is
 * a row with a history, so it carries two facts about who knows it that no art
 * has, and both are read here rather than invented:
 *
 *   `knownOwnershipBy`  who has learned where this came from. `revealOwnership`
 *                       is its writer and this is its first reader. Being on it
 *                       is certainty outright - you do not need social distance
 *                       from a room when you have been told the thing itself.
 *                       It GRANTS and never denies: an empty list is the
 *                       default `makeObject` gives everything, so reading it as
 *                       "nobody knows" would silence most of the catalog.
 *
 *   `undeclared`        the catalog's own marker for a thing whose owner has
 *                       never said it exists. The Hollow Court's four carry it
 *                       and nothing anywhere read it. A reference for the HOUSE
 *                       cannot supply a reference for an object the house has
 *                       never admitted to, and everybody in the province holds
 *                       a reference for the Hollow Court - so without this the
 *                       most secret objects in the world would be the most
 *                       widely recognised.
 *
 * ── AND THE PART THAT IS THE POINT ───────────────────────────────────────
 *
 * **Somebody who recognises it knows something you did not tell them.** The
 * record says who owns it and the fight says who is holding it, and when those
 * two are different people, recognising the object is learning what the carrier
 * must have done. That is {@link ThingRecognised.inTheWrongHands}, and it is
 * why this returns a reading about the OBJECT rather than a boolean about the
 * reader.
 *
 * A stolen blade with a name on it is a confession that walks into the room
 * ahead of you, and it is a confession precisely because ownership does not
 * move when possession does. See `items.md`, "how somebody comes to own a
 * thing": a thief does not become an owner however long they keep it, which is
 * what leaves the thread this check follows.
 *
 * ── NOTHING TO RECOGNISE IS A REAL ANSWER ────────────────────────────────
 *
 * A counted thing has no history to know. A notched sabre is a notched sabre;
 * several hundred exist, the catalog row is a KIND standing in for all of them,
 * and there is nothing anybody could recognise it AS. The gate is `keptAs`,
 * which `items.md` names as the one switch, rather than a comparison against
 * `'mundane'` written out again here.
 *
 * ── NOTHING BESPOKE ──────────────────────────────────────────────────────
 *
 * No faction branches and no object branches. Take away `keptAs`, the two
 * imported axes, `knownOwnershipBy` and the owner on the row, and there is
 * nothing left in this file.
 */

import { isAtLeast, type KnowingStage } from '../social/discovery.js';
import { keptAs, type ObjectRecord } from './possessions.js';
import {
    certaintyRank,
    whatTheGapItselfTells,
    whatTheirRealmAffords,
    whatTheirReferenceAffords,
    type Certainty,
    type HowFarOutOfTheirDepth
} from './recognising-whose-art-you-just-watched.js';

/**
 * The catalog's marker for an object whose owner has never said it exists.
 *
 * Named rather than open-coded because it is a fact the catalog authors on a
 * row - four rows carry it - and a bare string here would be a second place for
 * the spelling to drift from `artifacts.ts`.
 */
export const NOTHING_IS_SAID_ABOUT_IT = 'undeclared';

function lower(a: Certainty, b: Certainty): Certainty {
    return certaintyRank(a) <= certaintyRank(b) ? a : b;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS BEING LOOKED AT, AND BY WHOM
// ─────────────────────────────────────────────────────────────────────────

/**
 * Everything about the object this check reads.
 *
 * A structural subset rather than the whole record, so a caller holding a
 * catalog row, a world row or a copy of one can all ask - and so the fields it
 * reads are legible from the signature.
 *
 * ── `possessorId` IS WHO IS HOLDING IT UP, NOT WHAT THE REGISTER SAYS ────
 *
 * The caller sets it to whoever the observer is looking at, and for a player
 * that is emphatically NOT the world row's own value. A pouch row is not a
 * claim on the register (`items.md`), so a stolen thing's world row goes on
 * saying `possessorId: null` while somebody carries it about - which is the
 * whole coherent state, and reading it here would make the one interesting
 * answer, {@link ThingRecognised.inTheWrongHands}, unreachable for exactly the
 * case it exists for.
 *
 * Found by playing it: an NPC who had been told where a house's tally came from
 * watched a player swing it and read as merely recognising the thing, because
 * the register still had it in nobody's hand. So a caller passes
 * `{ ...row, possessorId: whoeverIsHoldingIt }`, and the check reads what is in
 * front of the observer rather than what the world last wrote down.
 */
export type ThingOnShow = Pick<
    ObjectRecord,
    'id' | 'name' | 'significance' | 'power' | 'possessorId' | 'ownerId' | 'ownerName' | 'knownOwnershipBy' | 'tags'
>;

export interface ThingObserver {
    /** Who is looking. Checked against `knownOwnershipBy`. */
    id: string;
    /**
     * The house they belong to, or null for somebody with none.
     *
     * Read twice, and both readings are the ruling's own sentence *the house
     * that lost it knows it across a courtyard*:
     *
     *   A MEMBER IS THE REFERENCE. Somebody of the house that owns the thing
     *   does not need social distance from a room measured for them - they are
     *   what the measurement is of. So the reference axis is `certain` for
     *   their own house's property and nothing else has to be stored to say so.
     *
     *   AND `knownOwnershipBy` NAMES HOUSES. The catalog puts faction ids on
     *   that list - three houses know where the first Heaven-Conversing volume
     *   came from and one of them is not its owner - so a reader standing for a
     *   house on it has been told, exactly as a named person on it has.
     */
    factionId: string | null;
    /** Where they stand on the ladder. The perceptual axis. */
    realmOrdinal: number;
    /**
     * Where they stand on the awareness ladder for one house. The reference
     * axis, per subject, exactly as the art check takes it.
     *
     * A callback so this module never learns where those rows live. In the
     * played game it is `KnowledgeGate.stageOf(id, 'sect', house)`.
     */
    referenceFor(factionId: string): KnowingStage;
}

/** What one reader got out of looking at one thing. */
export interface ThingRecognised {
    objectId: string;
    /**
     * A counted thing standing in for several hundred of itself. There is
     * nothing to recognise and that is not a failure - it is an absent subject,
     * the same shape as `nobodysArt` next door.
     */
    nothingToRecognise: boolean;
    /**
     * False when the rung gap alone put it out of reach: they saw somebody
     * holding something. A different sentence from having no reference, and the
     * two are not interchangeable.
     */
    perceived: boolean;
    /**
     * What the gap told them regardless of what they could name.
     *
     * Reported alongside the identification rather than folded into it,
     * because at the far end the two run in opposite directions - see the
     * banner over `whatTheGapItselfTells`. A reader far below an object gets no
     * name, no house and no provenance, and an unhedged statement that the
     * thing is beyond them. That is the most useful sentence the game can give
     * somebody deciding whether to touch it.
     */
    outOfTheirDepth: HowFarOutOfTheirDepth;
    /** What the rung afforded, on its own. */
    fromRealm: Certainty;
    /** What the reference afforded, on its own. */
    fromReference: Certainty;
    /** The lower of the two. Neither axis rescues the other. */
    reading: Certainty;
    /** The reader's reference for the owning house, unaltered. */
    reference: KnowingStage;
    /**
     * True when the reader is on the object's own `knownOwnershipBy`. They have
     * been told where this came from, which no amount of social distance from
     * anybody's hall substitutes for and which nothing substitutes for either.
     */
    toldWhereItCameFrom: boolean;
    /**
     * Whose it is, where the reading reaches far enough to say. Null when it
     * does not, and null is the answer rather than a gap - most people looking
     * at most things cannot say.
     */
    ownerId: string | null;
    ownerName: string;
    /**
     * The holder is not the owner, and the reader can tell.
     *
     * The whole point of the check. Somebody who recognises it now knows
     * something they were not told: whose it is, and therefore what the person
     * carrying it must have done to be holding it.
     */
    inTheWrongHands: boolean;
    /**
     * Recognising it announces that you move in rooms where such things are
     * discussed. The claim reveals the claimant, exactly as it does for an art.
     */
    revealsTheReader: boolean;
}

/**
 * Look at a thing somebody is carrying and read what you can off it.
 *
 * Pure. State in, a reading out, no mutation of either argument.
 */
export function whatTheyRecogniseAboutIt(
    thing: ThingOnShow,
    observer: ThingObserver
): ThingRecognised {
    const toldWhereItCameFrom = thing.knownOwnershipBy.includes(observer.id)
        || (observer.factionId !== null && thing.knownOwnershipBy.includes(observer.factionId));
    const theirOwnHouse = thing.ownerId !== null && observer.factionId === thing.ownerId;
    const reference: KnowingStage = thing.ownerId === null
        ? 'unaware'
        : theirOwnHouse ? 'known' : observer.referenceFor(thing.ownerId);

    // A thing worth nothing in a fight cannot be beyond anybody. Paper is not a
    // rung, and neither is a case, a tally or a seal - so the gap is measured
    // against a rating where there is one and is silent where there is not.
    const outOfTheirDepth = whatTheGapItselfTells(
        observer.realmOrdinal, thing.power ?? observer.realmOrdinal
    );

    const blank: ThingRecognised = {
        objectId: thing.id,
        nothingToRecognise: false,
        perceived: false,
        outOfTheirDepth,
        fromRealm: 'nothing',
        fromReference: 'nothing',
        reading: 'nothing',
        reference,
        toldWhereItCameFrom,
        ownerId: null,
        ownerName: '',
        inTheWrongHands: false,
        revealsTheReader: false
    };

    // A kind, not a thing. Nothing to know, and nobody to know it about.
    if (keptAs(thing.significance) === 'counted') {
        return { ...blank, nothingToRecognise: true, toldWhereItCameFrom: false };
    }

    // Paper is not a rung. `power` is null for everything that is worth nothing
    // in a fight, and being outclassed by a book is not a thing that happens -
    // which is the same reasoning `MANUALS_MAY_EXCEED_THE_LID` runs on.
    const fromRealm = thing.power === null
        ? 'certain' as Certainty
        : whatTheirRealmAffords(observer.realmOrdinal, thing.power);

    // Being told beats standing near a room. `knownOwnershipBy` is written by
    // `revealOwnership` for exactly this and grants rather than denies - see
    // the banner.
    const saidToExist = !thing.tags.includes(NOTHING_IS_SAID_ABOUT_IT);
    const fromReference: Certainty = saidToExist
        ? whatTheirReferenceAffords(reference)
        // `undeclared` means undeclared TO EVERYBODY ELSE. A house is never an
        // outsider to its own property, and that case is `knownAlready` below
        // rather than a second branch here.
        : 'nothing';

    // ── BEING TOLD IS NOT A PERCEPTION, AND IS NOT GATED LIKE ONE ────────
    //
    // The two axes answer "could they work it out from looking". Somebody who
    // has been told which object this is, or whose house owns it, is not
    // working anything out - they are remembering. So this route bypasses BOTH
    // axes rather than only the reference one.
    //
    // Found by a test rather than reasoned out first, and the case that found
    // it is the ruling's own sentence: a Sword Elder standing at twenty knows
    // their own house's forty-five ACROSS A COURTYARD, and a realm gate applied
    // to that reads out as not knowing it at all. A rung decides what you can
    // make of a thing you are looking at for the first time. It has nothing to
    // say about a thing you already know.
    //
    // `perceived` is deliberately left on the realm axis alone, because
    // knowing what a thing is and being able to read it are different, and
    // somebody may honestly be in the first state and not the second.
    const knownAlready = toldWhereItCameFrom || theirOwnHouse;
    const reading = knownAlready ? 'certain' : lower(fromRealm, fromReference);
    const placed = reading !== 'nothing';

    return {
        objectId: thing.id,
        nothingToRecognise: false,
        perceived: fromRealm !== 'nothing',
        outOfTheirDepth,
        fromRealm,
        fromReference,
        reading,
        reference,
        toldWhereItCameFrom,
        ownerId: placed ? thing.ownerId : null,
        ownerName: placed ? thing.ownerName : '',
        inTheWrongHands: placed
            && thing.ownerId !== null
            && thing.possessorId !== null
            && thing.possessorId !== thing.ownerId,
        // Being told is its own route, and so is owning the thing. Neither says
        // anything about where the reader spends their time: a house that was
        // robbed knows its own property without moving in any circles at all.
        revealsTheReader: placed
            && !toldWhereItCameFrom
            && !theirOwnHouse
            && isAtLeast(reference, 'encountered')
    };
}

/**
 * Everybody in a room who can tell what somebody is holding, strongest first.
 *
 * The shape the played game actually wants: not "can this one person tell" but
 * "who here just learned something". Sorted so a caller rendering one line
 * renders the person who knows the most, and by id after that so the order is
 * stable across runs.
 */
export function whoHereRecognisesIt<T extends ThingObserver>(
    thing: ThingOnShow,
    observers: readonly T[]
): { observer: T; read: ThingRecognised }[] {
    return observers
        .map(observer => ({ observer, read: whatTheyRecogniseAboutIt(thing, observer) }))
        .filter(row => row.read.reading !== 'nothing')
        .sort((a, b) =>
            certaintyRank(b.read.reading) - certaintyRank(a.read.reading)
            || a.observer.id.localeCompare(b.observer.id));
}
