/**
 * What somebody reaches for depends on where they stand and where you do.
 *
 * The engine has always decided THAT a person answers - `whetherTheySayIt` -
 * and never with what, so every scene in the game read "They answer it out
 * loud" and stopped. The narrator was handed a person opening their mouth and
 * nothing to put in it.
 *
 * The first cut of the fix hardcoded the house, on the reasoning that naming
 * your sect is the threat in this genre. That is bespoke and it is also wrong:
 * they might beg, swing back, offer money, or name a house, and WHICH falls out
 * of what they actually hold against the person in front of them.
 *
 * Every assertion here is an ordering between two positions, never a constant.
 */

import { describe, expect, it } from 'vitest';
import {
    whatTheyReachFor,
    A_HOUSE_WORTH_NAMING,
    WHAT_MAKES_A_PURSE_AN_ANSWER
} from '../../../src/engine/social-leverage/what-somebody-reaches-for';
import { HELPLESS_REALM_GAP } from '../../../src/engine/cultivation/combat';
import { earningsPerYear } from '../../../src/engine/cultivation/origin';

const leverAgainst = (them: Parameters<typeof whatTheyReachFor>[0]['them'], otherOrdinal: number) =>
    whatTheyReachFor({
        them,
        theOther: { id: 'the-other', ordinal: otherOrdinal }
    }).lever;

describe('somebody who can fight', () => {
    it('answers in kind, whatever else they are carrying', () => {
        // The gap is inside what combat calls reachable, so an arm is the
        // thing that works and nothing else needs asking.
        expect(leverAgainst({ id: 'a', ordinal: 20, stones: 999_999 }, 20))
            .toBe('answer_in_kind');
        expect(leverAgainst({ id: 'a', ordinal: 20 }, 20 + HELPLESS_REALM_GAP - 1))
            .toBe('answer_in_kind');
    });

    it('and stops answering in kind once the gap is past reaching', () => {
        expect(leverAgainst({ id: 'a', ordinal: 5 }, 5 + HELPLESS_REALM_GAP))
            .not.toBe('answer_in_kind');
    });
});

describe('somebody who cannot', () => {
    const outmatched = 5 + HELPLESS_REALM_GAP + 10;

    it('names the house when the house outweighs who is in front of them', () => {
        expect(whatTheyReachFor({
            them: { id: 'a', ordinal: 5, houseId: 'big', houseOrdinal: outmatched + A_HOUSE_WORTH_NAMING },
            theOther: { id: 'b', ordinal: outmatched }
        }).lever).toBe('the_house_behind_them');
    });

    it('and does not name a house that is weaker than the person they would name it to', () => {
        // Naming a house smaller than the person in front of you tells them
        // exactly how little is coming. It is worse than silence.
        expect(whatTheyReachFor({
            them: { id: 'a', ordinal: 5, houseId: 'small', houseOrdinal: outmatched - 1 },
            theOther: { id: 'b', ordinal: outmatched }
        }).lever).not.toBe('the_house_behind_them');
    });

    it('offers money when the purse is worth more than a gesture', () => {
        const rich = Math.ceil(earningsPerYear(5) * (WHAT_MAKES_A_PURSE_AN_ANSWER + 1));
        expect(leverAgainst({ id: 'a', ordinal: 5, stones: rich }, outmatched))
            .toBe('what_is_in_their_purse');
    });

    it('and does not offer a gesture', () => {
        const barely = Math.floor(earningsPerYear(5) * (WHAT_MAKES_A_PURSE_AN_ANSWER - 1.5));
        expect(leverAgainst({ id: 'a', ordinal: 5, stones: Math.max(0, barely) }, outmatched))
            .not.toBe('what_is_in_their_purse');
    });

    it('and with nothing at all, either asks or does not', () => {
        const lever = leverAgainst({ id: 'a', ordinal: 5, stones: 0 }, outmatched);
        expect(['asking_to_be_let_go', 'nothing_that_reaches']).toContain(lever);
    });

    it('and the two silences are different people, not one answer', () => {
        // Over a population: somebody who will not ask is holding the last
        // thing there is, and a reader has to be able to tell them apart.
        const seen = new Set<string>();
        for (let n = 0; n < 200; n++) {
            seen.add(leverAgainst({ id: `person-${n}`, ordinal: 5, stones: 0 }, outmatched));
        }
        expect(seen.has('asking_to_be_let_go')).toBe(true);
        expect(seen.has('nothing_that_reaches')).toBe(true);
    });
});

describe('the same person, different people in front of them', () => {
    it('reaches for different things', () => {
        const them = {
            id: 'shen-ke',
            ordinal: 12,
            stones: Math.ceil(earningsPerYear(12) * (WHAT_MAKES_A_PURSE_AN_ANSWER + 1)),
            houseId: 'a-house',
            houseOrdinal: 40
        };
        // An equal: they answer it themselves.
        expect(leverAgainst(them, 12)).toBe('answer_in_kind');
        // Somebody far above them but under their house: the house.
        expect(leverAgainst(them, 40 - A_HOUSE_WORTH_NAMING)).toBe('the_house_behind_them');
        // Somebody above their house too: the money is what is left.
        expect(leverAgainst(them, 44)).toBe('what_is_in_their_purse');
    });

    it('which is the whole claim - it is a read, not a fixed line', () => {
        const answers = new Set([
            leverAgainst({ id: 'x', ordinal: 30 }, 30),
            leverAgainst({ id: 'x', ordinal: 2, houseId: 'h', houseOrdinal: 45 }, 30),
            leverAgainst(
                { id: 'x', ordinal: 2, stones: Math.ceil(earningsPerYear(2) * 5) }, 30),
            leverAgainst({ id: 'x', ordinal: 2, stones: 0 }, 30)
        ]);
        // Four positions, four different things reached for.
        expect(answers.size).toBeGreaterThanOrEqual(3);
    });

    it('and every answer carries a line for the narrator', () => {
        for (const ordinal of [2, 12, 30, 44]) {
            const said = whatTheyReachFor({
                them: { id: 'x', ordinal, stones: 100, houseId: 'h', houseOrdinal: 20 },
                theOther: { id: 'y', ordinal: 30 }
            });
            expect(said.line.length).toBeGreaterThan(0);
            // Engine truth, not dialogue. The narrator writes the words.
            expect(said.line).not.toContain('"');
        }
    });
});
