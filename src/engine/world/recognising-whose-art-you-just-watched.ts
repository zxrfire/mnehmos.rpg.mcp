/**
 * Recognising whose art you just watched.
 *
 * The strongest check in `docs/world/houses/trust.md`'s hierarchy, and until this file
 * existed nothing in `src/engine/` could look at a technique being performed and
 * say which house it belongs to. `whoseArt` in `manuals.ts` already answered the
 * catalog half - which houses teach it - and nothing anywhere asked the other
 * half, which is the only half that varies: CAN THIS PARTICULAR READER TELL.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * TWO AXES, AND THEY MUST NOT BE COLLAPSED INTO ONE NUMBER
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   REALM is capability.   Can they perceive the demonstration at all, and
 *                          how exactly. Scales with the ladder.
 *   WORLDVIEW is reference. Do they hold any idea of what the art is SUPPOSED
 *                          to look like. Scales with a life, not with a rung.
 *
 * Both already exist in the engine, which is why this file adds no state.
 * Realm is an ordinal. Worldview is `KnowingStage` from
 * `../social/discovery.js`, held per subject - and the subject here is the
 * HOUSE, because a reference for an art is a reference for the body that
 * performs it. {@link ArtObserver.referenceFor} is deliberately a callback so
 * this module never has to know where those rows are stored; the web layer
 * hands it `KnowledgeGate.stageOf(holder, 'sect', factionId)` and a test hands
 * it a literal.
 *
 * The two come apart in both directions, and both failures are the point. A
 * recluse at the top of the ladder reads the demonstration exactly and has no
 * idea whose it is. A travelled steward at Foundation Establishment cannot
 * follow the movement and knows perfectly well which house moves like that.
 *
 * ── Where the reference comes from, and where it does not ─────────────────
 *
 * Guarding an art means refusing to TEACH it, not refusing to be seen doing
 * it. Houses compete, apexes included, because being challenged is how their
 * youngest and best grow - so the normal case is an art nobody can acquire and
 * the right people can recognise.
 *
 * But the public at a tournament is not the public. They are held in the
 * grandest cities and you have to be somebody, or connected to somebody, to
 * watch; money explicitly does not buy a seat. So the reference class is
 * aristocratic rather than broad, it spreads outward from whoever was in the
 * room losing a rung per hop, and `KnowingStage` is exactly that gradient:
 *
 *     was there                encountered / known   authenticate
 *     told by somebody who was placed                catch a bad imitation
 *     two or three hops out    named / whisper       be impressed, and be fooled
 *     beyond that              unaware               nothing
 *
 * WORLDVIEW ABOUT AN ART IS SOCIAL DISTANCE FROM A GATED ROOM, measured in
 * hops rather than in miles. Nothing in this file consults travel, and nothing
 * in it should: somebody who has crossed the world on foot may never have seen
 * an apex art performed, while a minor noble who has barely left one city has.
 *
 * ── An art tells you where somebody trained. Not whom they serve ──────────
 *
 * The reason the return type is called {@link WhereTheArtWasLearned} and
 * carries no allegiance field anywhere. This is not a caveat on an edge case,
 * it is what the check actually answers, and the strongest check in the
 * hierarchy therefore returns a true answer to a question nobody asked.
 *
 * The Hollow Court is the extreme case rather than an exception. It takes
 * nobody below a Void Refinement floor, so every one of its people arrived
 * already trained somewhere else and it holds as many arts as it has taken
 * people. A Seat performing an art shows their ORIGIN house's art - genuinely
 * theirs, honestly learned, perfectly recognisable, and completely misleading
 * about who they now serve. There is nothing to see through, and no code here
 * that tries. Anybody who has changed houses carries the same ambiguity; the
 * Court is simply an institution made of it.
 *
 * The Court's own top art is a different and much narrower thing. The Seats
 * pass it on when somebody reaches `LAST_CROSSING_TAUGHT_AT`, as the vehicle
 * for the last climb, and the only occasion it is used is a crossing almost
 * nobody witnesses - so the set who could recognise it is the Seats plus
 * whoever is currently making that climb. That is not a secret kept for
 * secrecy's sake; it is an instrument for a stretch of ladder four beings and
 * a handful of climbers have ever stood on, and it needs no special case here
 * because `referenceFor` returning `unaware` for everybody else says it.
 *
 * ── WHAT THE AWARENESS LADDER CANNOT HOLD, AND IS NOT MADE TO ─────────────
 *
 * `KnowingStage` runs `unaware → whisper → named → placed → encountered →
 * known` and every rung above the first PRESUMES A NAME ARRIVED FIRST. That is
 * exact for the channel it was built for - somebody said a word in front of
 * you - and it cannot express the state seeing produces, which inverts the
 * order: you have watched the thing and you hold no name for it.
 *
 * Four states, and the ladder holds three:
 *
 *     never seen it, never heard of it          `unaware`          held
 *     heard the name, never seen it performed   `named` / `placed` held
 *     SEEN IT PERFORMED, CANNOT NAME WHOSE      -                  NOT HELD
 *     seen it and can name whose            `encountered`/`known`  held
 *
 * The third row is a real and common condition - it is what a widely travelled
 * nobody is in, every time - and this file DELIBERATELY DOES NOT PRETEND TO
 * MODEL IT. Storing "would know it again" is new state, and this module's whole
 * claim is that it is a reading of state the world already keeps.
 *
 * What it does instead is refuse to collapse the third row into the first.
 * {@link WhereTheArtWasLearned.perceivedButCouldNotPlaceIt} says exactly that
 * happened: the rung was enough and the reference was not. A caller rendering
 * that as "you saw nothing" is wrong, and a caller rendering it as "you have
 * seen this style before" is also wrong, because nothing here knows whether
 * they have. The honest sentence is the narrow one - they followed it, and it
 * attaches to no house they can name.
 *
 * The world already contains the shape and has no machinery for it: a Blown
 * Ground finder sells a direction and a distance and does not lead the buyer
 * there. Knowing-where-without-knowing-what is a state the setting believes in
 * and the ladder cannot store. That absence is written up rather than papered
 * over, and it wants a rung of its own, or a second axis, decided by somebody
 * who owns `discovery.ts`.
 *
 * ── Nothing bespoke ───────────────────────────────────────────────────────
 *
 * No faction branches. The realm gate is `HELPLESS_REALM_GAP`, the constant the
 * combat layer already prices a hopeless confrontation with, read in the same
 * unit (major realms, not ordinals). The ownership half is `whoseArt`. The
 * reference half is `KnowingStage`. Take those three away and there is nothing
 * left in this file.
 */

import { isAtLeast, type KnowingStage } from '../social/discovery.js';
import { HELPLESS_REALM_GAP } from '../cultivation/combat.js';
import { REALM_TIERS, realmForOrdinal } from '../cultivation/realms.js';
import { noHouseCanCallItTheirs, whoseArt } from './manuals.js';

// ── THE PRIVATE COPY OF THIS PREDICATE IS GONE, AND THAT IS THE FIX ──────
//
// This file used to carry its own `noHouseCanCallItTheirs`, with a note saying
// it deliberately refused to use `isCommonlyHeld` - which returns true for
// everything without a `cap`, hence for every fighting art in the catalog, so a
// signature one house teaches read as nobody's. The note ended: *the
// discrepancy is reported rather than fixed*, because `isCommonlyHeld` had live
// consumers whose prices would move and whether a fighting art can be somebody's
// property was a design question rather than a bug to patch from here.
//
// It was answered: it can. `manuals.ts` now carries `noHouseCanCallItTheirs` as
// the property line for the whole codebase, `isCommonlyHeld` keeps the question
// it was written for - whether a stall stocks a thing - and the prices that were
// going to move have moved. This module was right first and is now reading the
// shared function instead of a copy of it.

// ─────────────────────────────────────────────────────────────────────────
// THE TWO AXES, EACH ON ITS OWN SCALE
// ─────────────────────────────────────────────────────────────────────────

/**
 * How much of an answer one axis is able to supply.
 *
 * Ordered, and the final reading is the LOWER of the two - which is the whole
 * of the model. Neither axis can rescue the other, and a reader who is short on
 * either gets an honestly hedged answer rather than a confident wrong one.
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
 * What the observer's RUNG lets them get out of watching, counted in major
 * realms against the rung the art was performed at.
 *
 *   two or more realms below   nothing. They saw a person move. `HELPLESS_REALM_GAP`
 *                              is the same gap at which the combat layer stops
 *                              calling a confrontation a fight, read here as the
 *                              gap at which it stops being a thing you can follow.
 *   one realm below            an impression. They followed the shape and not the
 *                              method.
 *   level with it              consistent. They can say it is not obviously wrong.
 *   a realm above or more      certain. At a glance, with no hedging.
 *
 * The last row is deliberately the reward: climbing turns a careful answer into
 * a flat one, which is progression a player can feel that is not combat power.
 */
export function whatTheirRealmAffords(observerOrdinal: number, performedAtOrdinal: number): Certainty {
    const gap = realmIndexOf(performedAtOrdinal) - realmIndexOf(observerOrdinal);
    if (gap >= HELPLESS_REALM_GAP) return 'nothing';
    if (gap === 1) return 'impression';
    if (gap === 0) return 'consistent';
    return 'certain';
}

/**
 * What the observer's REFERENCE for that house lets them get out of watching.
 *
 * The diffusion table above, transcribed. Nothing here is about the observer's
 * rung and nothing about their travels: it is how many hops they stand from a
 * room they would have needed standing to enter.
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
     * Where they stand on the awareness ladder for one house. The reference
     * axis, per subject, exactly as `KnowingStage` is already held.
     *
     * A callback rather than a map so this module never learns where those rows
     * live. In the played game it is `KnowledgeGate.stageOf(id, 'sect', house)`.
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
 *
 * There is no allegiance on this type, there is no current-house field, and
 * nothing here should ever grow one. An art is evidence about WHERE A BODY WAS
 * TRAINED. Whom that body now serves is a different question that this check
 * cannot reach, and a caller that reads `houses` as "who they are with" has
 * made the mistake the Hollow Court is entirely built out of.
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
     * The rung was enough and the reference was not: they followed what was
     * done and it attaches to no house they can name.
     *
     * On the type because the awareness ladder cannot store this state and
     * collapsing it into "saw nothing" is the wrong reading of the same
     * player. See the note at the head of the file. It is NOT a claim that
     * they have seen the style before - nothing here knows that.
     */
    perceivedButCouldNotPlaceIt: boolean;
    /**
     * The reader could only run this check by having been in rooms most people
     * cannot enter.
     *
     * Being able to say "that is the Azure Cloud's art, I have watched it
     * performed" announces that you move in a particular world - so the check
     * reveals the checker, and a claim to recognise is itself a claim somebody
     * can test. A social fact and not only a perceptual one, which is why it is
     * on the result rather than left for a caller to infer.
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
 *
 *   would_not_know_it    no reference. They cannot hold the question, and
 *                        saying "no" here would be a false negative dressed as
 *                        knowledge. The engine must never do that to a player.
 *   could_not_follow     the rung gap put the demonstration out of reach.
 *   consistent           it matches what they have heard described, and they
 *                        could not tell a good imitation from the real thing.
 *                        THE UNCERTAINTY IS THE ANSWER, and it is honest.
 *   inconsistent         it does not match what they have heard, and they are
 *                        equally unable to be sure.
 *   it_is               flat, at a glance, no hedging.
 *   it_is_not           the same, in the other direction.
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
 *
 * Never refused and never a lie. A reader short on either axis gets the
 * hedged verdict, and a reader with no reference at all is told that plainly
 * rather than handed a "no" they have not earned - the two are different
 * states and the player has to be able to tell them apart, because trusting
 * that hedging means hedging is the whole value of the verb.
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
