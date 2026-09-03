/**
 * "I'll take it" is how English speakers buy things, and it reached nothing.
 *
 * Played in Sweetspring Isle with thirty stones and a stall the game had just listed,
 * one turn apart, same item, same purse:
 *
 *   buy the Lesser Qi-Gathering Manual        bought, off Bai Xuping, 4 stones
 *   I'll take the Lesser Qi-Gathering Manual  "The thought does not resolve."
 *
 * The verb behind it was finished and excellent - it lands on the SELLER and
 * prices off why that person is selling today. Only the English was
 * unreachable.
 *
 * AND IT IS A MISSING LINE, NOT A RANKING FAULT. Measured over fourteen
 * ordinary ways of buying before the fix: 3 reached `buy`, and every failure
 * came back `unclear` with `target: null`. Nothing outranked anything - a noun
 * beating a verb would have left the noun behind, and there was no noun.
 */

import { parseIntent } from '../../src/web/actions';

const anOffer = (line: string) => parseIntent(line) as {
    action: string; intent?: string; target?: string;
};

describe('an offer to buy', () => {
    /** The sentence from the played turn, and its shape. */
    it('is the purchase it plainly is', () => {
        const bought = anOffer("I'll take the Lesser Qi-Gathering Manual");
        expect(bought.action).toBe('buy');
        expect(bought.target).toBe('Lesser Qi-Gathering Manual');
    });

    it('reaches every ordinary way of saying it', () => {
        for (const line of [
            "I'll take the Lesser Qi-Gathering Manual",
            "I'll take the cheaper of the two manuals",
            "I'll take it",
            'I will take the manual',
            'we will take two',
            'let me have the manual',
            "I'd like to buy that",
            'I would like to take that',
            'get me that book'
        ]) {
            expect(anOffer(line).action, line).toBe('buy');
        }
    });

    /**
     * The target has to survive, or the sentence resolves to the right verb and
     * hands it nothing to buy - which is the same dead end wearing a verb name.
     */
    it('keeps hold of what is being bought', () => {
        expect(anOffer('let me have the manual').target).toBe('manual');
        expect(anOffer('get me that book').target).toBe('that book');
        expect(anOffer("I'll take the cheaper of the two manuals").target)
            .toBe('cheaper of the two manuals');
    });
});

/**
 * AND THE BARE PHRASING STAYS WHERE IT WAS.
 *
 * `take` is deliberately NOT added to `BUYING_VERBS`. The buy branch says in as
 * many words that taking a thing off somebody full stop is the `steal` intent,
 * so this matches the OFFER forms - a future, a request, a politeness - and
 * never `I take the manual`. "I'll take" is a sentence somebody says across a
 * counter; "I take" is not.
 */
describe('and it takes nothing from the verbs next door', () => {
    it('leaves a theft a theft', () => {
        const took = anOffer('I take his purse');
        expect(took.action).toBe('interact');
        expect(took.intent).toBe('steal');
    });

    it('leaves taking work and taking a duty alone', () => {
        expect(anOffer('I take the work').action).toBe('work');
        expect(anOffer('I take a duty').action).toBe('sect');
    });

    /** Scoped to a determiner, so it cannot reach a plea to be got out. */
    it('does not read a way out as a purchase', () => {
        expect(anOffer('get me out of here').action).not.toBe('buy');
    });

    /**
     * `give me` is left alone on purpose and reported instead: "give me the
     * cheaper one" is a purchase, and the same two words in front of somebody's
     * possession are a demand, so it wants a narrower home than this pattern.
     */
    it('does not turn a demand into a purchase', () => {
        expect(anOffer('give me your purse').action).not.toBe('buy');
    });
});
