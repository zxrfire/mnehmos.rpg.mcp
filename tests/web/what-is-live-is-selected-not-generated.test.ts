/**
 * The rules the live-situation read keeps, pinned where they are decided.
 *
 * Three of them, and each was a way of getting this wrong that was argued for
 * while it was being built:
 *
 * 1. DENSITY IS A PROPERTY OF THE PLACE. Nothing is spawned to fill a quiet
 *    turn. A crossing with nobody on it, no wall and no stall produces the
 *    emptiness and the road out, and a market town produces six facts, because
 *    that is what is standing in each. The ruling: *"sometimes you are in
 *    bumfuck nowhere"* - an empty place must be allowed to be empty, and what
 *    is playable there is the horizon.
 *
 * 2. SHOWN IS NOT TOLD. Colours on a sleeve are seen by anybody standing there;
 *    whose they are is a thing you have to have been told. The discovery gate
 *    had been deciding both, which is a locked room with the key inside it: the
 *    player was shown only what they already knew, so there was nothing to point
 *    a verb at and no way for the gate to open. The name reaches the narrator
 *    marked, and never the player.
 *
 * 3. A REPEAT IS SUPPRESSED AND A CHANGE IS NOT. The suppression is keyed on
 *    the fact, and the caller stamps its memory with the ground and the day - so
 *    looking twice in one square on one day says it once, and the same door a
 *    day nearer is a different fact.
 */

import { whatIsLiveForYouHere, type WhatIsLiveInput } from '../../src/web/what-is-live-for-you-here';

const NOTHING: WhatIsLiveInput = {
    ordinal: 0,
    spiritStones: 30,
    practisesAMethod: false,
    theBindingGate: 'No cultivation method, so nothing accumulates however long you sit.',
    doorsPostedHere: [],
    booksOnAStallHere: [],
    goodsOnOfferHere: [],
    sellersHere: 0,
    thickerGroundWithinReach: [],
    ambient: 'normal',
    peopleHere: 0,
    coloursHereTheyCannotPlace: [],
    dutiesGoing: 0
};

describe('what is live is selected out of the place, never generated for the turn', () => {
    it('gives empty ground the road out rather than a stranger', () => {
        const read = whatIsLiveForYouHere({
            ...NOTHING,
            thickerGroundWithinReach: [{ name: 'The Living Ice', ambient: 'spirit_tide', travelDays: 4 }]
        });
        const said = read.toldToThePlayer.join('\n');
        expect(said).toContain('The Living Ice');
        expect(said, 'the walk is not priced').toContain('4 days off');
    });

    it('says the emptiness plainly when there is not even a road', () => {
        const read = whatIsLiveForYouHere(NOTHING);
        expect(read.toldToThePlayer.join('\n')).toContain('Nobody is on this ground');
    });

    it('gives busier ground more to pull on than empty ground', () => {
        const bare = whatIsLiveForYouHere(NOTHING);
        const town = whatIsLiveForYouHere({
            ...NOTHING,
            doorsPostedHere: [{
                houseName: 'Sand Well Caravan',
                saying: 'Sand Well Caravan is holding an intake at Orchid Terrace in 3 days.',
                admissionOrdinal: 0,
                inDays: 3
            }],
            booksOnAStallHere: [
                { name: 'Lesser Qi-Gathering Manual', askStones: 8, opensAtOrdinal: 0, carriesToOrdinal: 13 }
            ],
            goodsOnOfferHere: [{ name: 'Cloud Treading Steps', askStones: 4 }],
            sellersHere: 1,
            peopleHere: 5,
            dutiesGoing: 2
        });
        expect(town.toldToThePlayer.length).toBeGreaterThan(bare.toldToThePlayer.length);
    });

    it('prices the book that closes the gate against the purse', () => {
        const read = whatIsLiveForYouHere({
            ...NOTHING,
            spiritStones: 30,
            booksOnAStallHere: [
                { name: 'Lesser Qi-Gathering Manual', askStones: 8, opensAtOrdinal: 0, carriesToOrdinal: 13 }
            ]
        });
        const said = read.toldToThePlayer.join('\n');
        expect(said).toContain('Lesser Qi-Gathering Manual');
        expect(said).toContain('8 spirit stones');
        expect(said, 'the purse is not said beside the price').toContain('30 spirit stones');
    });

    it('shows the colours and does not tell the player whose they are', () => {
        const read = whatIsLiveForYouHere({
            ...NOTHING,
            peopleHere: 3,
            coloursHereTheyCannotPlace: ['Frostmirror Court']
        });
        expect(read.toldToThePlayer.join('\n'), 'a name the player has not been told reached them')
            .not.toContain('Frostmirror Court');
        expect(read.toldToThePlayer.join('\n')).toContain('colours');
        expect(read.forTheNarrator.join('\n'), 'the narrator was not given the house at all')
            .toContain('Frostmirror Court');
        expect(read.namedAndNotHeld, 'the output-side audit was not armed with it')
            .toContain('Frostmirror Court');
    });

    it('says a fact once on one ground on one day, and the caller decides which day', () => {
        const town: WhatIsLiveInput = {
            ...NOTHING,
            doorsPostedHere: [{
                houseName: 'Sand Well Caravan',
                saying: 'Sand Well Caravan is holding an intake at Orchid Terrace in 3 days.',
                admissionOrdinal: 0,
                inDays: 3
            }]
        };
        const first = whatIsLiveForYouHere(town);
        expect(first.toldToThePlayer.join('\n')).toContain('Sand Well Caravan');
        expect(first.keysSaid.length).toBeGreaterThan(0);

        const again = whatIsLiveForYouHere({ ...town, alreadySaidHereToday: first.keysSaid });
        expect(again.toldToThePlayer.join('\n'), 'the same door was stated twice')
            .not.toContain('Sand Well Caravan');

        // And a day later the caller's stamp has moved, so nothing is withheld.
        const tomorrow = whatIsLiveForYouHere({
            ...town,
            doorsPostedHere: [{ ...town.doorsPostedHere[0], inDays: 2 }],
            alreadySaidHereToday: []
        });
        expect(tomorrow.toldToThePlayer.join('\n')).toContain('Sand Well Caravan');
    });
});
