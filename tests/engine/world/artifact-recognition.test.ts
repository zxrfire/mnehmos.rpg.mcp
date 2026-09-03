/**
 * A famous thing is recognised the way a famous art is.
 *
 * The owner's ruling, in `docs/world/things/items.md`. What is under test is
 * that the object read is the ART read pointed at an object - two axes, the
 * lower of the two, no confident wrong answers - and the three consequences the
 * ruling names: carrying one is a statement, recognising one tells you
 * something you were not told, and recognition is uneven.
 *
 * Every case is built from a REAL catalog row rather than a fixture, because
 * the rows are what the world actually contains and a fixture would let this
 * pass over a catalog that had stopped saying any of it.
 */

import { describe, it, expect } from 'vitest';
import {
    whatTheyRecogniseAboutIt,
    whoHereRecognisesIt,
    NOTHING_IS_SAID_ABOUT_IT,
    type ThingObserver,
    type ThingOnShow
} from '../../../src/engine/world/artifact-recognition.js';
import { certaintyRank } from '../../../src/engine/world/recognising-whose-art-you-just-watched.js';
import { getArtifact } from '../../../src/data/cultivation/artifacts.js';
import type { KnowingStage } from '../../../src/engine/social/discovery.js';

/** A catalog row, put into somebody's hand. */
function inTheHandOf(artifactId: string, holderId: string): ThingOnShow {
    const row = getArtifact(artifactId);
    if (!row) throw new Error(`no catalog row for ${artifactId}`);
    return { ...row, possessorId: holderId };
}

function looker(
    over: Partial<ThingObserver> & { reference?: KnowingStage } = {}
): ThingObserver {
    const reference = over.reference ?? 'unaware';
    return {
        id: over.id ?? 'npc-somebody',
        factionId: over.factionId ?? null,
        realmOrdinal: over.realmOrdinal ?? 40,
        referenceFor: over.referenceFor ?? (() => reference)
    };
}

const THIEF = 'player-1';

describe('recognising a thing somebody is carrying', () => {
    it('has nothing to recognise in a counted thing, whoever is looking', () => {
        // A notched sabre off a dead bandit. Several hundred exist and the row
        // is a KIND standing in for all of them, so there is no history to
        // know and nobody it could belong to. An absent subject, not a failure.
        const sabre = inTheHandOf('artifact-notched-sabre', THIEF);
        expect(sabre.significance).toBe('mundane');

        const read = whatTheyRecogniseAboutIt(sabre, looker({
            realmOrdinal: 45, reference: 'known'
        }));
        expect(read.nothingToRecognise).toBe(true);
        expect(read.reading).toBe('nothing');
        expect(read.inTheWrongHands).toBe(false);
    });

    it('tells the house that lost it, across a courtyard', () => {
        // The ruling's own sentence. A member of the owning house needs no
        // social distance measured for them - they are what it would measure.
        const tally = inTheHandOf('artifact-azure-sword-tally', THIEF);
        const elder = looker({
            id: 'npc-sword-elder',
            factionId: 'sect-azure-cloud-pavilion',
            realmOrdinal: 20,
            reference: 'unaware'
        });

        const read = whatTheyRecogniseAboutIt(tally, elder);
        expect(read.reading).toBe('certain');
        expect(read.ownerId).toBe('sect-azure-cloud-pavilion');
        // And this is the point of the check: they now know something the
        // person carrying it did not tell them.
        expect(read.inTheWrongHands).toBe(true);
        // Knowing your own house's property says nothing about where you spend
        // your time.
        expect(read.revealsTheReader).toBe(false);
    });

    it('tells a village carter nothing about the same object', () => {
        // No reference and no rung. Both axes empty, which is the ordinary
        // case for almost everybody who ever sees almost anything.
        const carter = looker({ id: 'npc-carter', realmOrdinal: 0, reference: 'unaware' });
        const read = whatTheyRecogniseAboutIt(inTheHandOf('artifact-azure-sword-tally', THIEF), carter);

        expect(read.reading).toBe('nothing');
        expect(read.ownerId).toBeNull();
        // Not knowing whose it is is not the same as not knowing it is a
        // sword. The check says the first and claims nothing about the second.
        expect(read.nothingToRecognise).toBe(false);
    });

    it('lets neither axis rescue the other, for somebody working it out by sight', () => {
        // The Standing Edge, rated forty-five: the widest gap in the catalog
        // between a thing and the people who might look at it.
        const edge = inTheHandOf('artifact-the-standing-edge', THIEF);

        // A life and no rung. They have heard the Pavilion described at length
        // and what is in front of them is a sword.
        const wellRead = whatTheyRecogniseAboutIt(edge, looker({ realmOrdinal: 0, reference: 'known' }));
        expect(wellRead.fromReference).toBe('certain');
        expect(wellRead.fromRealm).toBe('nothing');
        expect(wellRead.reading).toBe('nothing');
        expect(wellRead.perceived).toBe(false);

        // A rung and no life: they follow what they are looking at and it
        // attaches to nobody they can name. The rung is asserted as "enough to
        // perceive it" rather than pinned to a value, because what a given
        // ordinal affords is the ladder's business and moves with it.
        const recluse = whatTheyRecogniseAboutIt(edge, looker({ realmOrdinal: 44, reference: 'unaware' }));
        expect(recluse.perceived).toBe(true);
        expect(certaintyRank(recluse.fromRealm)).toBeGreaterThan(0);
        expect(recluse.fromReference).toBe('nothing');
        expect(recluse.reading).toBe('nothing');
    });

    it('tells somebody far below to back away from a thing they cannot name', () => {
        // The design owner, correcting the realm axis: *"being unable to read
        // something is itself a sign."* Identification and the sense of danger
        // run in OPPOSITE directions at the far end, and this is the pair.
        const edge = inTheHandOf('artifact-the-standing-edge', THIEF);
        const nobody = looker({ id: 'npc-carter', realmOrdinal: 0, reference: 'known' });

        const read = whatTheyRecogniseAboutIt(edge, nobody);
        // No name, no house, no provenance.
        expect(read.reading).toBe('nothing');
        expect(read.ownerId).toBeNull();
        expect(read.perceived).toBe(false);
        // And one thing, unhedged, which is the sentence that keeps them alive.
        expect(read.outOfTheirDepth.beyondThem).toBe(true);
        expect(read.outOfTheirDepth.certainty).toBe('certain');
    });

    it('has nothing to feel about a thing that is worth nothing in a fight', () => {
        // Paper is not a rung, and neither is a case or a tally. A book cannot
        // be beyond anybody, so the gap is silent rather than guessed at.
        const volume = getArtifact('volume-heaven-conversing-first')!;
        expect(volume.power).toBeNull();

        const read = whatTheyRecogniseAboutIt(
            { ...volume, possessorId: THIEF },
            looker({ id: 'npc-carter', realmOrdinal: 0 })
        );
        expect(read.outOfTheirDepth.beyondThem).toBe(false);
        expect(read.outOfTheirDepth.certainty).toBe('nothing');
    });

    it('does not gate somebody who already knows behind a rung', () => {
        // The ruling's own sentence, and the case that corrected the model. A
        // Sword Elder standing at twenty is four realms under the Pavilion's
        // forty-five and knows it across a courtyard: they are not working it
        // out by sight, they are remembering. A realm gate applied to that
        // reads out as not knowing their own house's property at all.
        const edge = inTheHandOf('artifact-the-standing-edge', THIEF);
        const elder = looker({
            id: 'npc-sword-elder', factionId: 'sect-azure-cloud-pavilion', realmOrdinal: 20
        });

        const read = whatTheyRecogniseAboutIt(edge, elder);
        expect(read.fromRealm).toBe('nothing');
        expect(read.reading).toBe('certain');
        expect(read.inTheWrongHands).toBe(true);
        // Knowing what it is and being able to read it are different, and the
        // result says both rather than collapsing them.
        expect(read.perceived).toBe(false);
    });

    it('reads the catalog\'s own list of who was told, and lets it name a house', () => {
        // The first Heaven-Conversing volume. Three houses know where it came
        // from and one of them does not own it - which is the catalog already
        // saying recognition is uneven, in a field nothing had ever read.
        const volume = getArtifact('volume-heaven-conversing-first')!;
        expect(volume.knownOwnershipBy).toContain('house-ninefold-ledger');
        expect(volume.ownerId).toBe('house-anchorhold');

        const onShow: ThingOnShow = { ...volume, possessorId: THIEF };
        // A Ledger clerk with no reference for the Anchorhold at all, and a
        // rung that would not matter either way - a book is not a rung.
        const clerk = looker({
            id: 'npc-clerk', factionId: 'house-ninefold-ledger', realmOrdinal: 2, reference: 'unaware'
        });

        const read = whatTheyRecogniseAboutIt(onShow, clerk);
        expect(read.toldWhereItCameFrom).toBe(true);
        expect(read.reading).toBe('certain');
        expect(read.ownerId).toBe('house-anchorhold');
        expect(read.inTheWrongHands).toBe(true);

        // And a house that is NOT on the list gets no help from it: the field
        // grants and never denies, so this one falls back to the two axes.
        const stranger = looker({
            id: 'npc-stranger', factionId: 'sect-the-severed', realmOrdinal: 2, reference: 'unaware'
        });
        expect(whatTheyRecogniseAboutIt(onShow, stranger).reading).toBe('nothing');
    });

    it('keeps an undeclared thing unrecognisable to everybody but its own house', () => {
        // The Hollow Court has never said its four exist. Everybody in the
        // province holds a reference for the Court, so without the object's own
        // silence being read the most secret things in the world would be the
        // most widely recognised.
        const silent = getArtifact('hollow-unwritten-length')!;
        expect(silent.tags).toContain(NOTHING_IS_SAID_ABOUT_IT);

        const onShow: ThingOnShow = { ...silent, possessorId: THIEF };
        const wellConnected = looker({
            id: 'npc-elder', factionId: 'sect-azure-cloud-pavilion', realmOrdinal: 44, reference: 'known'
        });
        expect(whatTheyRecogniseAboutIt(onShow, wellConnected).reading).toBe('nothing');

        // The Court itself is not an outsider to its own property.
        const seat = looker({
            id: 'npc-hollow-court-second-seat', factionId: 'sect-hollow-court', realmOrdinal: 43
        });
        const read = whatTheyRecogniseAboutIt(onShow, seat);
        expect(read.reading).toBe('certain');
        expect(read.inTheWrongHands).toBe(true);
    });

    it('says nothing was learned when the thing is where it belongs', () => {
        const tally = getArtifact('artifact-azure-sword-tally')!;
        const inTheVault: ThingOnShow = { ...tally, possessorId: tally.ownerId };
        const read = whatTheyRecogniseAboutIt(inTheVault, looker({
            factionId: 'sect-azure-cloud-pavilion', realmOrdinal: 20
        }));

        expect(read.reading).toBe('certain');
        // Recognised, and no confession in it. Carrying a famous thing is a
        // statement; carrying your own is not an admission.
        expect(read.inTheWrongHands).toBe(false);
    });

    it('reveals the reader when the reference came from the room', () => {
        const read = whatTheyRecogniseAboutIt(
            inTheHandOf('artifact-azure-sword-tally', THIEF),
            looker({ id: 'npc-travelled', realmOrdinal: 30, reference: 'encountered' })
        );
        expect(read.reading).toBe('certain');
        // Being able to say what it is announces that you move in a particular
        // world, exactly as claiming to recognise an art does.
        expect(read.revealsTheReader).toBe(true);
    });

    it('ranks a room by who can tell, strongest first', () => {
        const tally = inTheHandOf('artifact-azure-sword-tally', THIEF);
        const room: ThingObserver[] = [
            looker({ id: 'npc-carter', realmOrdinal: 0, reference: 'unaware' }),
            looker({ id: 'npc-heard-a-name', realmOrdinal: 30, reference: 'named' }),
            looker({ id: 'npc-elder', factionId: 'sect-azure-cloud-pavilion', realmOrdinal: 30 })
        ];

        const who = whoHereRecognisesIt(tally, room);
        // The carter is not in the list at all - not "recognised nothing", but
        // absent, because a room read that names everybody names nobody.
        expect(who.map(row => row.observer.id)).toEqual(['npc-elder', 'npc-heard-a-name']);
        expect(who[0].read.reading).toBe('certain');
        expect(who[1].read.reading).toBe('impression');
    });
});
