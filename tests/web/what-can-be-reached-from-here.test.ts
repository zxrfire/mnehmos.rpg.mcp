/**
 * What is within reach, and every name it answers to.
 *
 * The property that matters is the round trip: a name on this list is a name
 * that resolves BACK to the thing it was listed under. A list that offered a
 * phrase the resolver then refused would be worse than no list, because a
 * reader trusts it.
 */

import { describe, expect, it } from 'vitest';

import {
    theDescriptionThisIs,
    whoTheDescriptionFits
} from '../../src/web/a-target-can-be-a-description';
import {
    whatCanBeReachedFromHere,
    whatThePhraseReaches,
    whoTheWordsLandedOn,
    type SomebodyPresent
} from '../../src/web/what-can-be-reached-from-here';

const HOLLOW_COURT = 'sect-hollow-court';

const person = (over: Partial<SomebodyPresent> & { id: string }): SomebodyPresent => ({
    name: over.id, sex: 'male', age: 40, realmOrdinal: 20,
    sectRank: null, sectId: null, sectName: null, ...over
});

/** A disciple of the Hollow Court, and a woman from no house at all. */
const disciple = person({
    id: 'shen', name: 'Shen Yuan', sectId: HOLLOW_COURT,
    sectName: 'The Hollow Court', sectRank: 'disciple'
});
const stranger = person({ id: 'lin', name: 'Lin Wei', sex: 'female', age: 22 });

const world = {
    observer: { ordinal: 20, sectId: null, rankIndex: null },
    alignmentOf: () => null,
    rankIndexOf: () => null,
    tiesTo: () => []
};

const reachIn = (present: readonly SomebodyPresent[]) =>
    whatCanBeReachedFromHere({ ...world, present });

describe('what is within reach', () => {
    it('has everybody standing here on it', () => {
        const reach = reachIn([disciple, stranger]);
        expect(reach.filter(r => r.kind === 'person').map(r => r.name))
            .toEqual(['Shen Yuan', 'Lin Wei']);
    });

    /**
     * A house is here because somebody of it is, and `through` is who. That is
     * the disciple who has to decide what to do about what he just heard.
     */
    it('has a house on it only through somebody who answers to it', () => {
        const withHim = reachIn([disciple, stranger]);
        const court = withHim.find(r => r.kind === 'house');
        expect(court?.name).toBe('The Hollow Court');
        expect(court?.through?.name).toBe('Shen Yuan');

        expect(reachIn([stranger]).some(r => r.kind === 'house')).toBe(false);
    });

    it('answers to the short form of a house name', () => {
        const reach = reachIn([disciple]);
        expect(whatThePhraseReaches('the Hollow Court', reach)?.id).toBe(HOLLOW_COURT);
        expect(whatThePhraseReaches('the Court', reach)?.id).toBe(HOLLOW_COURT);
    });

    /** Said on the other side of the map, it reaches nothing. */
    it('does not reach a house nobody here answers to', () => {
        expect(whatThePhraseReaches('the Hollow Court', reachIn([stranger]))).toBeNull();
    });
});

describe('who the words landed on', () => {
    const present = [disciple, stranger];

    it('lands on every member of a house that was named', () => {
        const court = reachIn(present).find(r => r.kind === 'house')!;
        expect(whoTheWordsLandedOn(court, present).map(w => w.name)).toEqual(['Shen Yuan']);
    });

    it('lands on one person when one person was named', () => {
        const her = reachIn(present).find(r => r.id === 'lin')!;
        expect(whoTheWordsLandedOn(her, present).map(w => w.name)).toEqual(['Lin Wei']);
    });

    /**
     * The other side of the map. Nobody was named, which is not the same as
     * nobody hearing it: the square still watched somebody say it.
     */
    it('lands on nobody when nothing here was named', () => {
        expect(whoTheWordsLandedOn(null, present)).toEqual([]);
    });
});

describe('every name on the list resolves back to the thing under it', () => {
    /**
     * The round trip, over a square with enough people in it to make the
     * descriptions compete. Anything this list offers, the resolver has to
     * answer with the same person.
     */
    const crowd: SomebodyPresent[] = [
        disciple,
        stranger,
        person({ id: 'gu', name: 'Gu Feng', age: 71, realmOrdinal: 34 }),
        person({ id: 'mei', name: 'Mei Lan', sex: 'female', age: 55, realmOrdinal: 12 })
    ];

    it('never offers a phrase that reaches somebody else', () => {
        const reach = whatCanBeReachedFromHere({ ...world, present: crowd });
        const wrong: string[] = [];
        for (const thing of reach) {
            if (thing.kind !== 'person') continue;
            for (const phrase of thing.alsoCalled) {
                const description = theDescriptionThisIs(phrase);
                const fits = description === null
                    ? []
                    : whoTheDescriptionFits({ ...world, description, candidates: crowd });
                if (fits[0]?.id !== thing.id) {
                    wrong.push(`${thing.name} is offered "${phrase}", which reaches `
                        + `${fits[0]?.name ?? 'nobody'}`);
                }
            }
        }
        expect(wrong).toEqual([]);
    });

    it('offers something for somebody a description can single out', () => {
        const reach = whatCanBeReachedFromHere({ ...world, present: crowd });
        const her = reach.find(r => r.id === 'lin')!;
        expect(her.alsoCalled.length).toBeGreaterThan(0);
    });
});
