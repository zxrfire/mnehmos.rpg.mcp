/**
 * Recognising whose art you just watched.
 */

import { isAtLeast, type KnowingStage } from '../social/discovery.js';
import { HELPLESS_REALM_GAP } from '../cultivation/combat.js';
import { REALM_TIERS, realmForOrdinal } from '../cultivation/realms.js';
import { noHouseCanCallItTheirs, whoseArt } from './manuals.js';

// THE PRIVATE COPY OF THIS PREDICATE IS GONE, AND THAT IS THE FIX

// ─────────────────────────────────────────────────────────────────────────
// THE TWO AXES, EACH ON ITS OWN SCALE
// ─────────────────────────────────────────────────────────────────────────

/**
 * How much of an answer one axis is able to supply.
 */
export type Certainty = 'nothing' | 'impression' | 'consistent' | 'certain';

const CERTAINTY_ORDER: readonly Certainty[] = ['nothing', 'impression', 'consistent', 'certain'];

export function certaintyRank(c: Certainty): number {
    const at = CERTAINTY_ORDER.indexOf(c);
    return at < 0 ? 0 : at;
}

function lower(a: Certainty, b: Certainty): Certainty {
    return certaintyRank(a) <= certaintyRank(b) ? a : b;
}

function realmIndexOf(ordinal: number): number {
    const key = realmForOrdinal(ordinal).key;
    return REALM_TIERS.findIndex(t => t.key === key);
}

/**
 * What the observer's RUNG lets them get out of watching, counted in major realms
 * against the rung the art was performed at.
 */
export function whatTheirRealmAffords(observerOrdinal: number, performedAtOrdinal: number): Certainty {
    const gap = realmIndexOf(performedAtOrdinal) - realmIndexOf(observerOrdinal);
    if (gap >= HELPLESS_REALM_GAP) return 'nothing';
    if (gap === 1) return 'impression';
    if (gap === 0) return 'consistent';
    return 'certain';
}

// THE TWO AXES DO NOT FAIL THE SAME WAY

/** What the gap itself told them, whatever they could or could not name. */
export interface HowFarOutOfTheirDepth {
    /** Major realms the thing stands above the reader. Negative when they are above it. */
    realmsAbove: number;
    /**
     * Past the gap at which a contest is not a contest, in the reader's own
     * body. Nothing about this is hedged and nothing about it is a guess.
     */
    beyondThem: boolean;
    /**
     * How sure they are of THAT - which rises as identification falls. `nothing`
     * where they are level with it or above it, because somebody standing over
     * a thing their own size is not out of their depth and has nothing to feel.
     */
    certainty: Certainty;
    /** Engine-authored, and it always says which of the two directions it is. */
    account: string;
}

/**
 * What the rung gap tells the reader on its own.
 */
export function whatTheGapItselfTells(
    observerOrdinal: number,
    atOrdinal: number
): HowFarOutOfTheirDepth {
    const realmsAbove = realmIndexOf(atOrdinal) - realmIndexOf(observerOrdinal);

    if (realmsAbove >= HELPLESS_REALM_GAP) {
        return {
            realmsAbove,
            beyondThem: true,
            certainty: 'certain',
            account:
                `${realmsAbove} major realms above them, which is past the gap at which a `
                + 'contest is not a contest. They cannot name it and they are in no doubt at all '
                + 'about what it would do to them. Being unable to read a thing is itself the '
                + 'reading.'
        };
    }
    if (realmsAbove === 1) {
        return {
            realmsAbove,
            beyondThem: false,
            certainty: 'impression',
            account:
                'A realm above them. Enough to feel that they are the smaller party and not '
                + 'enough to be certain of it, which is the rung at which people get themselves '
                + 'killed.'
        };
    }
    return {
        realmsAbove,
        beyondThem: false,
        certainty: 'nothing',
        account: realmsAbove === 0
            ? 'Level with them. There is nothing here to feel outmatched by.'
            : `${-realmsAbove} major realms under them. Whatever else it is, it is not a `
                + 'thing that is going to hurt them.'
    };
}

/**
 * What the observer's REFERENCE for that house lets them get out of watching.
 */
export function whatTheirReferenceAffords(reference: KnowingStage): Certainty {
    if (isAtLeast(reference, 'encountered')) return 'certain';
    if (isAtLeast(reference, 'placed')) return 'consistent';
    if (isAtLeast(reference, 'named')) return 'impression';
    return 'nothing';
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS BEING WATCHED, AND BY WHOM
// ─────────────────────────────────────────────────────────────────────────

export interface ArtDemonstration {
    /** Row id in the technique catalog. */
    techniqueId: string;
    /**
     * The rung it was performed at - the PERFORMER's, not the art's required
     * ordinal. Somebody far above the manual's floor is doing something a
     * beginner could not follow even where the book is a beginner's book.
     */
    performedAtOrdinal: number;
}

export interface ArtObserver {
    /** Where they stand on the ladder. The perceptual axis. */
    realmOrdinal: number;
    /**
     * Where they stand on the awareness ladder for one house. The reference axis,
     * per subject, exactly as `KnowingStage` is already held.
     */
    referenceFor(factionId: string): KnowingStage;
}

/** What one reader got out of watching, about one house. */
export interface HouseReading {
    factionId: string;
    /** The reader's reference for this house, unaltered. */
    reference: KnowingStage;
    /** What the rung afforded, on its own. */
    fromRealm: Certainty;
    /** What the reference afforded, on its own. */
    fromReference: Certainty;
    /** The lower of the two. Neither axis rescues the other. */
    reading: Certainty;
}

/**
 * The answer, named so that the thing it does not say is impossible to miss.
 */
export interface WhereTheArtWasLearned {
    techniqueId: string;
    /**
     * False when the rung gap alone put the demonstration out of reach. The
     * reader saw a person move and nothing else, and this is a different
     * sentence from having no reference - both are honest, and they are not
     * interchangeable.
     */
    perceived: boolean;
    /**
     * A manual on the common shelf belongs to nobody, so there is no check to
     * run: watching somebody breathe through a primer half the province owns
     * says nothing about anybody. Not a failure - an absent subject.
     */
    nobodysArt: boolean;
    /** One entry per house that teaches it, strongest reading first. */
    houses: HouseReading[];
    /** The strongest reading reached against any house. */
    best: Certainty;
    /**
     * The rung was enough and the reference was not: they followed what was done
     * and it attaches to no house they can name.
     */
    perceivedButCouldNotPlaceIt: boolean;
    /**
     * What the rung gap told them regardless of what they could name.
     */
    outOfTheirDepth: HowFarOutOfTheirDepth;
    /**
     * The reader could only run this check by having been in rooms most people
     * cannot enter.
     */
    revealsTheReader: boolean;
}

/**
 * Watch somebody perform an art and read what you can off it.
 *
 * Pure. State in, a reading out, no mutation of either argument.
 */
export function whereThisArtWasLearned(
    demonstration: ArtDemonstration,
    observer: ArtObserver
): WhereTheArtWasLearned {
    const { techniqueId, performedAtOrdinal } = demonstration;
    const fromRealm = whatTheirRealmAffords(observer.realmOrdinal, performedAtOrdinal);
    const perceived = fromRealm !== 'nothing';
    const nobodysArt = noHouseCanCallItTheirs(techniqueId);

    const owners = nobodysArt ? [] : whoseArt(techniqueId);
    const houses: HouseReading[] = owners.map(factionId => {
        const reference = observer.referenceFor(factionId);
        const fromReference = whatTheirReferenceAffords(reference);
        return {
            factionId,
            reference,
            fromRealm,
            fromReference,
            reading: lower(fromRealm, fromReference)
        };
    });

    // Strongest first, then by id so the order is stable across runs. A world
    // that reorders its catalog must not reorder an answer.
    houses.sort((a, b) =>
        certaintyRank(b.reading) - certaintyRank(a.reading) || a.factionId.localeCompare(b.factionId));

    const best = houses.reduce<Certainty>((acc, h) => (certaintyRank(h.reading) > certaintyRank(acc) ? h.reading : acc), 'nothing');

    return {
        techniqueId,
        perceived,
        nobodysArt,
        houses,
        best,
        perceivedButCouldNotPlaceIt: perceived && !nobodysArt && owners.length > 0 && best === 'nothing',
        outOfTheirDepth: whatTheGapItselfTells(observer.realmOrdinal, performedAtOrdinal),
        // Only an art that belongs to somebody can reveal anything about the
        // reader, and only a reference that came from the room can.
        revealsTheReader: !nobodysArt && houses.some(h => isAtLeast(h.reference, 'encountered'))
    };
}

// ─────────────────────────────────────────────────────────────────────────
// ANSWERING A CLAIM
// "Is this the Azure Cloud's art?" - which is the question a player asks, and
// the reason the graded answer exists rather than a boolean.
// ─────────────────────────────────────────────────────────────────────────

/**
 * What a reader can honestly say about ONE named house.
 */
export type ClaimVerdict =
    | 'would_not_know_it'
    | 'could_not_follow'
    | 'consistent'
    | 'inconsistent'
    | 'it_is'
    | 'it_is_not';

export interface ClaimReading {
    claimedFactionId: string;
    verdict: ClaimVerdict;
    /** True when the art really is taught by the house that was named. */
    theHouseDoesTeachIt: boolean;
    /** The reader's position on the two axes, carried so a caller can say why. */
    reading: Certainty;
    fromRealm: Certainty;
    fromReference: Certainty;
    reference: KnowingStage;
    /** The full reading this was taken from. */
    learned: WhereTheArtWasLearned;
}

/**
 * Put a specific claim to the check.
 */
export function couldTheyTellItIs(
    demonstration: ArtDemonstration,
    observer: ArtObserver,
    claimedFactionId: string
): ClaimReading {
    const learned = whereThisArtWasLearned(demonstration, observer);
    const theHouseDoesTeachIt = !learned.nobodysArt && whoseArt(demonstration.techniqueId).includes(claimedFactionId);

    const reference = observer.referenceFor(claimedFactionId);
    const fromRealm = whatTheirRealmAffords(observer.realmOrdinal, demonstration.performedAtOrdinal);
    const fromReference = whatTheirReferenceAffords(reference);
    const reading = lower(fromRealm, fromReference);

    const verdict: ClaimVerdict =
        fromReference === 'nothing' ? 'would_not_know_it'
            : fromRealm === 'nothing' ? 'could_not_follow'
                : reading === 'certain' ? (theHouseDoesTeachIt ? 'it_is' : 'it_is_not')
                    : theHouseDoesTeachIt ? 'consistent' : 'inconsistent';

    return {
        claimedFactionId,
        verdict,
        theHouseDoesTeachIt,
        reading,
        fromRealm,
        fromReference,
        reference,
        learned
    };
}

/** Verdicts a reader can act on without hedging. */
export function isFlat(verdict: ClaimVerdict): boolean {
    return verdict === 'it_is' || verdict === 'it_is_not';
}
