/**
 * A target is a description, and every verb that takes one gets it.
 *
 * The design owner's run of examples, each of which was a sentence the game
 * could not answer:
 *
 *   > i should be able to ask WHO'S IN CHARGE HERE to nobody in particular
 *   > "i kill the one nearest to me" (madmen do that often)
 *   > or i kill (description) like the youngest girl? the oldest man?
 *   > i kill members of all righteous sects/demonic sects
 *   > and replace kill with other verb too
 *   > or like "you, void refinement cultivator"
 *   > also saying elder is very common
 *   > people call people by title a lot in xianxia, not just by name
 *   > uncle, sister, etc
 *
 * The half of this that is not a parser is the safety property: a description
 * is recognised only when every word in it is a description word, so a name
 * reaches the name resolver untouched.
 */

import { describe, expect, it } from 'vitest';

import {
    theDescriptionThisIs,
    whoTheDescriptionFits,
    type SomebodyDescribable
} from '../../src/web/a-target-can-be-a-description';

function person(over: Partial<SomebodyDescribable> & { id: string }): SomebodyDescribable {
    return {
        name: `Person ${over.id}`,
        sex: 'female',
        age: 30,
        realmOrdinal: 4,
        sectRank: null,
        sectId: null,
        ...over
    };
}

/** Nobody stands anywhere in particular and nothing is tied to anything. */
const NO_WORLD = {
    observer: { ordinal: 10, sectId: null, rankIndex: null },
    alignmentOf: () => null,
    rankIndexOf: () => null,
    tiesTo: () => []
};

const fits = (query: string, candidates: readonly SomebodyDescribable[], world = NO_WORLD) => {
    const description = theDescriptionThisIs(query);
    expect(description, `"${query}" was not read as a description`).not.toBeNull();
    return whoTheDescriptionFits({ description: description!, candidates, ...world })
        .map(who => who.id);
};

describe('what a phrase describes', () => {
    it('does not touch a name', () => {
        expect(theDescriptionThisIs('Jiang Suilin')).toBeNull();
        expect(theDescriptionThisIs('the youngest Jiang')).toBeNull();
        expect(theDescriptionThisIs('Elder Jiang')).toBeNull();
        expect(theDescriptionThisIs('')).toBeNull();
    });

    /** Every word carries nothing, so there is nothing here to resolve. */
    it('does not read a bare pointer as a description', () => {
        expect(theDescriptionThisIs('someone')).toBeNull();
        expect(theDescriptionThisIs('the person here')).toBeNull();
    });

    it('reads an ordering, a sex, a rank, a leaning and a realm', () => {
        expect(theDescriptionThisIs('the youngest girl')).toMatchObject({
            end: 'youngest', sex: 'female'
        });
        expect(theDescriptionThisIs('the oldest man')).toMatchObject({
            end: 'oldest', sex: 'male'
        });
        expect(theDescriptionThisIs('the one nearest to me')).toMatchObject({ end: 'nearest' });
        expect(theDescriptionThisIs('the elder')).toMatchObject({ rank: 'elder' });
        expect(theDescriptionThisIs('a righteous cultivator')).toMatchObject({
            alignment: 'righteous'
        });
        expect(theDescriptionThisIs('you, void refinement cultivator')).toMatchObject({
            realmKey: 'void_refinement'
        });
    });

    it('reads a title as a position rather than as a rank word', () => {
        expect(theDescriptionThisIs('senior brother')).toMatchObject({
            standing: 'above', sameHouse: true, sex: 'male'
        });
        expect(theDescriptionThisIs('junior sister')).toMatchObject({
            standing: 'below', sameHouse: true, sex: 'female'
        });
        // "senior brother" is never read as "senior", which is why the titles
        // are taken out longest first.
        expect(theDescriptionThisIs('senior brother')!.sex).toBe('male');
        expect(theDescriptionThisIs('fellow daoist')).not.toBeNull();
    });
});

describe('who a description picks out', () => {
    const square = [
        person({ id: 'a', sex: 'female', age: 19, realmOrdinal: 2 }),
        person({ id: 'b', sex: 'female', age: 60, realmOrdinal: 30 }),
        person({ id: 'c', sex: 'male', age: 24, realmOrdinal: 11 }),
        person({ id: 'd', sex: 'male', age: 71, realmOrdinal: 8 })
    ];

    /** The narrowing binds first, so it is the youngest OF THE GIRLS. */
    it('narrows before it orders', () => {
        expect(fits('the youngest girl', square)[0]).toBe('a');
        expect(fits('the oldest man', square)[0]).toBe('d');
        expect(fits('the youngest', square)[0]).toBe('a');
        expect(fits('the oldest woman', square)[0]).toBe('b');
    });

    it('reads nearest off the ladder, because there is no distance here', () => {
        // The observer stands at 10, so the person at 11 is nearest to them.
        expect(fits('the one nearest to me', square)[0]).toBe('c');
        expect(fits('the strongest one here', square)[0]).toBe('b');
        expect(fits('the weakest one here', square)[0]).toBe('a');
    });

    it('answers with nobody where the description fits nobody', () => {
        expect(fits('the youngest girl', [person({ id: 'x', sex: 'male' })])).toEqual([]);
    });

    it('picks people out by the leaning of the house they answer to', () => {
        const houses = [
            person({ id: 'r', sectId: 'good' }),
            person({ id: 'e', sectId: 'bad' }),
            person({ id: 'n', sectId: null })
        ];
        const alignmentOf = (sectId: string | null) =>
            sectId === 'good' ? 'righteous' as const
                : sectId === 'bad' ? 'demonic' as const : null;
        expect(fits('a righteous cultivator', houses, { ...NO_WORLD, alignmentOf })).toEqual(['r']);
        expect(fits('a demonic cultivator', houses, { ...NO_WORLD, alignmentOf })).toEqual(['e']);
    });

    it('picks a realm out by its own name', () => {
        const ladder = [
            person({ id: 'low', realmOrdinal: 3 }),
            person({ id: 'void', realmOrdinal: 30 })
        ];
        expect(fits('you, void refinement cultivator', ladder)).toEqual(['void']);
        expect(fits('the qi condensation one', ladder)).toEqual(['low']);
    });
});

describe('a title, which is how people are addressed here', () => {
    const house = {
        observer: { ordinal: 10, sectId: 'ours', rankIndex: 2 },
        alignmentOf: () => null,
        rankIndexOf: (_sectId: string | null, title: string | null) =>
            title === null ? null : Number(title),
        tiesTo: () => []
    };
    const brothers = [
        person({ id: 'above', sex: 'male', sectId: 'ours', sectRank: '5' }),
        person({ id: 'below', sex: 'male', sectId: 'ours', sectRank: '1' }),
        person({ id: 'outside', sex: 'male', sectId: 'theirs', sectRank: '5' })
    ];

    it('reads senior and junior off the house ladder, and only inside the house', () => {
        expect(fits('senior brother', brothers, house)).toEqual(['above']);
        expect(fits('junior brother', brothers, house)).toEqual(['below']);
    });

    /**
     * A house is the ladder a title is read against, so somebody with no house
     * has none to read - and the only ordering both parties can see is the one
     * everybody in this world can see.
     */
    it('falls to the ladder everybody can see where there is no house', () => {
        const rogue = { ...house, observer: { ordinal: 10, sectId: null, rankIndex: null } };
        expect(fits('senior', [
            person({ id: 'higher', realmOrdinal: 30 }),
            person({ id: 'lower', realmOrdinal: 2 })
        ], rogue)).toEqual(['higher']);
    });

    /** Uncle is a martial generation and it is also blood, and either answers. */
    it('takes either meaning of a kinship word', () => {
        const byBlood = {
            ...house,
            observer: { ordinal: 10, sectId: null, rankIndex: null },
            tiesTo: (id: string) => (id === 'blood' ? ['kin'] : [])
        };
        expect(fits('uncle', [
            person({ id: 'blood', sex: 'male', realmOrdinal: 2 }),
            person({ id: 'stranger', sex: 'male', realmOrdinal: 2 })
        ], byBlood)).toEqual(['blood']);
    });
});
