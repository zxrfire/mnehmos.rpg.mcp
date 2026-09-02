/**
 * The company sentence has to survive being about one person.
 *
 * Found by playing. The second paragraph a new run ever prints was:
 *
 *   "One other person ARE about, none of whom are looking at you. One of them
 *    is out of reach in a way that does not invite comparison, and the way THE
 *    OTHERS move around them is the part worth noticing."
 *
 * Two failures in one sentence, and both are the same mistake: the template was
 * written for a crowd and then handed a number the crowd words do not fit. The
 * verb disagrees, and it goes on to refer to "the others" - a group that does
 * not exist, because the only other person in the square is the one being
 * described.
 *
 * The zero case is the same defect one step further along: with a single
 * standout and nobody else, the old template still said "one of them" (of
 * whom?) and still had "the others" moving around somebody nobody is near.
 *
 * These pin the counts where the plural words stop being true - 0, 1 and 2 -
 * rather than the prose, so a rewrite of the sentence is free and a relapse
 * into plural-only phrasing is not.
 */

import { describe, it, expect } from 'vitest';

import { factsForCompany, type Company } from '../../src/web/facts';
import type { Cultivator } from '../../src/schema/cultivation';

/**
 * `factsForCompany` reads a location and a rung and nothing else, so the rest
 * of the sheet would be decoration. Kept deliberately thin: a fixture that
 * fills in fields the function never touches invites the next reader to
 * believe one of them matters.
 */
function standingIn(place: string, ordinal: number): Cultivator {
    return { location: place, realmOrdinal: ordinal } as Cultivator;
}

/** How far above the observer somebody has to be to get singled out. */
const NOTABLE = 6;

/** The words that are only true of more than one person. */
const PLURAL_ONLY = [
    /\bare about\b/,
    /\bthe others\b/,
    /\bnone of whom\b/,
    /\bone of them\b/i
];

function pluralSlips(text: string): string[] {
    return PLURAL_ONLY.filter(p => p.test(text)).map(String);
}

describe('the company sentence at the counts where plural stops being true', () => {
    it('says one other person is about, in the singular, with no phantom others', () => {
        const company: Company = { named: [], strangers: [{ ordinal: 0 }], total: 1 };
        const facts = factsForCompany(standingIn('Thirdwall', 0), company);
        const prose = facts.prose;

        expect(pluralSlips(prose)).toEqual([]);
        // The person is still reported. A grammar fix that drops the fact is
        // not a fix.
        expect(prose).toMatch(/one other person/i);
    });

    it('does not send a crowd around a standout who is the only one here', () => {
        // One stranger, far enough above to be singled out - so the crowd the
        // old sentence described was the empty remainder.
        const company: Company = { named: [], strangers: [{ ordinal: NOTABLE }], total: 1 };
        const prose = factsForCompany(standingIn('Thirdwall', 0), company).prose;

        expect(pluralSlips(prose)).toEqual([]);
        // Standing is still what is said about them; that is the whole point of
        // lifting somebody out of the count.
        expect(prose).toMatch(/out of reach|far enough ahead|so far above|somewhat ahead/);
    });

    it('does not call a single bystander "the others" around a standout', () => {
        const company: Company = {
            named: [],
            strangers: [{ ordinal: NOTABLE }, { ordinal: 0 }],
            total: 2
        };
        const prose = factsForCompany(standingIn('Thirdwall', 0), company).prose;

        expect(prose).not.toMatch(/\bthe others\b/);
        expect(prose).not.toMatch(/\bare about\b/);
        expect(prose).toMatch(/one other person/i);
    });

    it('still uses the plural once there is a plural to use', () => {
        const company: Company = {
            named: [],
            strangers: [{ ordinal: 0 }, { ordinal: 0 }, { ordinal: 0 }],
            total: 3
        };
        const prose = factsForCompany(standingIn('Thirdwall', 0), company).prose;

        expect(prose).toMatch(/\bare about\b/);
        expect(prose).toMatch(/three others/i);
    });

    it('answers an empty square without inventing anybody', () => {
        const company: Company = { named: [], strangers: [], total: 0 };
        const prose = factsForCompany(standingIn('Thirdwall', 0), company).prose;

        expect(prose).toMatch(/nobody is about/i);
        expect(pluralSlips(prose)).toEqual([]);
    });
});
