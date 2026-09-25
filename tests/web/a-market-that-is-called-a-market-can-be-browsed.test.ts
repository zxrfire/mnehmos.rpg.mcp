/**
 * A house's name supplies no intent, and no house is called a counter any more.
 *
 * Two houses in the catalog were once named for a word that is also an intent:
 * the Clear River Alliance (`negotiate` matched "alliance") and the house that
 * is now the Silver Island Hall, which was then a Market (`trade` matched
 * "market"). They claimed their own intent out of their own names - measured
 * over every row of `SECTS`, "where is the Clear River Alliance" came back a
 * negotiation and "where is" the Market a haggle, while the other thirty-six
 * houses travelled.
 *
 * `withoutTheHousesNamed` fixed that by reading the intent off the sentence
 * with the proper names taken out, and it took a genuine sentence with it:
 * browsing a market that happened to be called a Market lost the only market
 * noun it had. The cure was the verb - **a name may not supply an intent, and a
 * verb may** - so "I browse" the Market reached the board because the verb said
 * read a counter and the name said this body is one. `READING_ACROSS_A_COUNTER`
 * in `verb-pattern-table.ts` still reads the counter word off a house's NAME.
 *
 * Then the owner ruled that no word of a name may be a word the player types
 * (AGENTS.md, "A name evokes what it is"), and `market` is a verb the table acts
 * on, so the Market became the Silver Island Hall and no house is called a
 * counter at all. What is left to hold is the half that was always the point:
 * the name supplies nothing on its own, and a house that is not a counter is
 * not made into a stall.
 */

import { describe, it, expect } from 'vitest';

import { parseIntent } from '../../src/web/actions';
import { SECTS } from '../../src/data/cultivation/sects';

type Plan = { action?: string; intent?: string; target?: string };
const read = (line: string) => parseIntent(line) as Plan;

/** How a player addresses a house, which is the name without its article. */
const asked = (house: { name: string }) => house.name.replace(/^The\s+/, '');

/** The houses whose own names carry a counter word, asked of the catalog. */
const COUNTERS = SECTS.filter(house => /\b(?:market|bazaar|stalls?|exchange)\b/i.test(house.name));

describe('a house and the counter word', () => {
    it('is never what a house is called, because the counter words are words the player types', () => {
        expect(COUNTERS.map(house => house.name)).toEqual([]);
    });

    /**
     * AND THE NAME STILL SUPPLIES NOTHING ON ITS OWN.
     *
     * This is the half the cure was written for, and it is swept over all 38
     * because it is the half a widening breaks first.
     */
    it('is somewhere to travel to when nothing but the name says trade', () => {
        const wrong = SECTS
            .map(house => [house.name, read(`where is the ${asked(house)}`)] as const)
            .filter(([, plan]) => plan.action !== 'destinations');
        expect(wrong.map(([name, plan]) => `${name} -> ${plan.action}/${plan.intent}`))
            .toEqual([]);
    });

    /**
     * AND BROWSING A HOUSE THAT IS NOT A COUNTER REACHES NOTHING, which is the
     * correct answer: there is no board at a sect to read across, and inventing
     * one for every house would be the name supplying an intent again, one
     * direction over.
     */
    it('does not make every house a stall', () => {
        const board = SECTS
            .map(house => [house.name, read(`i browse the ${asked(house)}`)] as const)
            .filter(([, plan]) => plan.action === 'market');
        expect(board.map(([name]) => name)).toEqual([]);
    });

    /** And the plain market sentences, which never named a house at all. */
    it('leaves the counter in front of the player alone', () => {
        expect(read('i browse the market').action).toBe('market');
        expect(read('i browse the stalls').action).toBe('market');
        expect(read('what is for sale here').action).toBe('market');
    });
});
