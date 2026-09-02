/**
 * What a house wants comes off what the house IS, and never off a table.
 *
 * Three cases, and all three are produced by one count and one existing
 * function. Nothing in the module under test authors a price, a threshold, or a
 * per-house rule, and these tests are the statement of that:
 *
 *   a line that holds        the house is selling a rung and a price meets it
 *   a line with spares       the house is short of a carrier and prices its
 *                            own decay
 *   the last carrier         a present need, and a present need is a refusal
 *                            at any figure - which is the insular clan
 *
 * The last one is the design decision that would otherwise live only as the
 * number zero in `othersCarryingTheLineAsWell`, so it is pinned here by name.
 */

import { describe, expect, it } from 'vitest';

import {
    aFavourOwedPutOnTheTable,
    whatAHouseWouldTakeForAMatch,
    whoAgreesAndWhoDoesNot,
    PARENTS_BALK_AT,
    type APartyToAMatch,
    type TheHouseBeingAsked
} from '../../../src/engine/household/what-a-house-would-take-for-a-match.js';
import { REGARD_BANDS } from '../../../src/schema/cultivation.js';
import type { OnTheTable } from '../../../src/engine/social-leverage/what-somebody-would-take-for-a-thing-they-will-not-sell.js';

const carrier: APartyToAMatch = {
    personId: 'p-on-the-roll',
    reachesTo: 12,
    carriesTheLineAt: 'final',
    houseId: 'sect-house',
    onTheRoll: 'by blood'
};

const outsider: APartyToAMatch = {
    personId: 'p-outside',
    reachesTo: 12,
    carriesTheLineAt: null,
    houseId: null,
    onTheRoll: null
};

const house = (othersCarryingTheLineAsWell: number): TheHouseBeingAsked => ({
    houseId: 'sect-house',
    reachesTo: 25,
    othersCarryingTheLineAsWell
});

const enough: OnTheTable[] = [
    { what: 'a sealed road nobody else teaches', carriesThemTo: 12, singular: true }
];

describe('what a house is short of', () => {
    it('is nothing it cannot buy when the match holds the line', () => {
        const both = { ...outsider, carriesTheLineAt: 'final' as const };
        const answer = whatAHouseWouldTakeForAMatch({
            house: house(0), theirs: carrier, theOther: both, table: enough
        });

        expect(answer.theLineStepsDown).toBe(false);
        expect(answer.shortOf).toBe('nothing it cannot buy');
        expect(answer.theLineTheChildrenWouldCarry).toBe('final');
        // Nothing of the house's is spent, so the ordinary price applies and a
        // met price is a trade the house would entertain.
        expect(answer.price.itIsATrade).toBe(true);
    });

    it('is a carrier for the line when the match spends one, and it still has a price', () => {
        const answer = whatAHouseWouldTakeForAMatch({
            house: house(2), theirs: carrier, theOther: outsider, table: enough
        });

        expect(answer.theLineStepsDown).toBe(true);
        expect(answer.shortOf).toBe('a carrier for the line');
        // A house with spares prices its own decay rather than refusing it.
        expect(answer.price.itIsATrade).toBe(true);
    });

    it('is the house itself when this is the last carrier, and no figure reaches it', () => {
        const answer = whatAHouseWouldTakeForAMatch({
            house: house(0), theirs: carrier, theOther: outsider, table: enough
        });

        expect(answer.theLineStepsDown).toBe(true);
        expect(answer.price.itIsATrade).toBe(false);
        // The existing module's own word for a present need, unmodified.
        expect(answer.price.why).toBe('they_need_it_themselves');
        // And the price is still stated, because a player told what something
        // costs is better served than one told only no.
        expect(answer.price.theHeightToReach).toBe(carrier.reachesTo);
    });

    it('is the insular clan: the last carrier refuses out and accepts in', () => {
        // The whole of the difference is what the OTHER side carries. One count,
        // one existing function, and a closed clan falls out of both.
        const out = whatAHouseWouldTakeForAMatch({
            house: house(0), theirs: carrier, theOther: outsider, table: enough
        });
        const withinTheLine = whatAHouseWouldTakeForAMatch({
            house: house(0),
            theirs: carrier,
            theOther: { ...outsider, carriesTheLineAt: 'final' },
            table: enough
        });

        expect(out.price.itIsATrade).toBe(false);
        expect(withinTheLine.price.itIsATrade).toBe(true);
    });

    it('does not decide for somebody the house only houses', () => {
        const resident: APartyToAMatch = { ...carrier, onTheRoll: null };
        const answer = whatAHouseWouldTakeForAMatch({
            house: house(3), theirs: resident, theOther: outsider, table: enough
        });

        expect(answer.price.why).toBe('the_answer_is_not_theirs_to_give');
        // And the sentence sends the player at the party who can answer, rather
        // than at a door nobody built.
        expect(answer.line).toMatch(/asking them|their family/i);
    });
});

describe('the list of what can be offered is open', () => {
    /**
     * Ten media the module has never heard of, priced identically.
     *
     * The same guard `what-somebody-would-take-for-a-thing-they-will-not-sell.ts`
     * carries, pointed at a match: if a branch on what a thing IS ever appears,
     * these stop agreeing.
     */
    const TEN: readonly string[] = [
        'four thousand spirit stones',
        'a road nobody else teaches',
        'a manual out of a hole nobody has been down',
        'a beast core taken off something above the change',
        'a word from somebody standing at the top of the province',
        'a debt of two hundred years, forgiven',
        'a place found at a house for a sibling',
        'protection over a valley for as long as the house holds it',
        'an alliance against a body that has been leaning on them',
        'a name held on a register nobody else can read'
    ];

    it('prices all ten the same when they carry the same distance', () => {
        const answers = TEN.map(what => whatAHouseWouldTakeForAMatch({
            house: house(4),
            theirs: carrier,
            theOther: outsider,
            table: [{ what, carriesThemTo: 12, singular: true }]
        }));

        const first = answers[0];
        for (const answer of answers) {
            expect(answer.price.itIsATrade).toBe(first.price.itIsATrade);
            expect(answer.price.theBestOnTheTable).toBe(first.price.theBestOnTheTable);
            expect(answer.price.why).toBe(first.price.why);
        }
    });

    it('takes a favour owed as one of them, at the rung of whoever owes it', () => {
        const put = aFavourOwedPutOnTheTable(
            { id: 'ob-1', kind: 'favor', subjectId: 'elder-who-owes-you', status: 'open' },
            27
        );
        expect(put.carriesThemTo).toBe(27);
        expect(put.singular).toBe(true);

        // A rogue with nothing else. The house is holding somebody at rung 12
        // and a word from rung 27 clears that on the one scale.
        const answer = whatAHouseWouldTakeForAMatch({
            house: house(4), theirs: carrier, theOther: outsider, table: [put]
        });
        expect(answer.price.itIsATrade).toBe(true);
    });

    it('treats a settled favour as worth nothing rather than refusing it', () => {
        const spent = aFavourOwedPutOnTheTable(
            { id: 'ob-2', kind: 'favor', subjectId: 'elder-who-owed-you', status: 'settled' },
            27
        );
        expect(spent.singular).toBe(false);

        const answer = whatAHouseWouldTakeForAMatch({
            house: house(4), theirs: carrier, theOther: outsider, table: [spent]
        });
        expect(answer.price.why).toBe('nothing_was_put_down');
    });
});

describe('who agrees and who does not', () => {
    it('never answers for the person, because consent has one resolver', () => {
        const answer = whatAHouseWouldTakeForAMatch({
            house: house(4), theirs: carrier, theOther: outsider, table: enough
        });
        const says = whoAgreesAndWhoDoesNot(answer);
        const person = says.says.find(s => s.party === 'the person');

        expect(person).toBeDefined();
        expect(person?.inFavour).toBeNull();
    });

    it('has the house paid and the parents against it, which is the interesting state', () => {
        // The house has spares and takes the price. The parents are looking at
        // grandchildren who carry less than their children do.
        const answer = whatAHouseWouldTakeForAMatch({
            house: house(2), theirs: carrier, theOther: outsider, table: enough
        });
        const says = whoAgreesAndWhoDoesNot(answer);

        expect(says.says.find(s => s.party === 'the house')?.inFavour).toBe(true);
        expect(says.says.find(s => s.party === 'the parents')?.inFavour).toBe(false);
        expect(says.theyDisagree).toBe(true);
        expect(says.onlyThePersonIsLeftToAsk).toBe(false);
    });

    it('names the state that produces somebody running', () => {
        const both = { ...outsider, carriesTheLineAt: 'final' as const };
        const answer = whatAHouseWouldTakeForAMatch({
            house: house(0), theirs: carrier, theOther: both, table: enough
        });
        const says = whoAgreesAndWhoDoesNot(answer);

        // Both answered parties agree and nobody has asked the person. That is
        // the closed-clan case, and it is where the running path starts.
        expect(says.onlyThePersonIsLeftToAsk).toBe(true);
    });
});

describe('a family objects at the ends and nowhere else', () => {
    /**
     * `PARENTS_BALK_AT` is a decision that would otherwise live only as a list
     * nobody reads twice, so it is asserted by name.
     *
     * A match across a gulf is remarked on in both directions - the higher
     * family is giving something away and the lower one is being taken from -
     * and everything in between is ordinary.
     */
    it('is the two ends of the band table and nothing in the middle', () => {
        const all = REGARD_BANDS.map(row => row.band);
        expect(PARENTS_BALK_AT).toHaveLength(2);
        expect(PARENTS_BALK_AT).toContain(all[0]);
        expect(PARENTS_BALK_AT).toContain(all[all.length - 1]);

        for (const middle of all.slice(1, -1)) {
            expect(PARENTS_BALK_AT).not.toContain(middle);
        }
    });

    it('lets two families a rung or two apart get on with it', () => {
        const answer = whatAHouseWouldTakeForAMatch({
            house: house(4),
            theirs: { ...carrier, carriesTheLineAt: null },
            theOther: { ...outsider, reachesTo: 14 },
            table: enough
        });
        const says = whoAgreesAndWhoDoesNot(answer);

        expect(says.says.find(s => s.party === 'the parents')?.inFavour).toBe(true);
    });
});
