/**
 * "I browse the Silver Island Market" reached nothing, and the cure caused it.
 *
 * Two houses in the catalog are named for a word that is also an intent: the
 * Clear River Alliance (`negotiate` matches "alliance") and the Silver Island
 * Market (`trade` matches "market"). They claimed their own intent out of their
 * own names - measured over every row of `SECTS`, "where is the Clear River
 * Alliance" came back a negotiation and "where is the Silver Island Market" a
 * haggle, while the other thirty-six houses travelled.
 *
 * `withoutTheHousesNamed` fixed that by reading the intent off the sentence
 * with the proper names taken out, and it took a genuine sentence with it:
 * browsing a market that happens to be called a Market lost the only market
 * noun it had. Measured after: `i browse the Silver Island Market` and `i
 * peruse the Silver Island Market` reached nothing, while `i shop at` and `i
 * browse the stalls at` the same house both reached the board.
 *
 * ── WHAT TELLS THE TWO READINGS APART IS THE VERB ────────────────────────
 *
 * Both readings are legitimate and neither is ambiguous once the rule is said
 * plainly: **a name may not supply an intent, and a verb may.** "Where is the
 * Silver Island Market" has no claim on trade except the name, so it travels.
 * "I browse the Silver Island Market" carries a verb that means read a counter,
 * and the body it is aimed at is a counter - the catalog says so in its own
 * name - so it reaches the board.
 *
 * `browse` and `peruse` were on no list in the table. Nothing else moves:
 * `haggle` already reaches a bargain put to a party, `look over` and `look
 * through` already reach a look at the place, and taking a working sentence off
 * a working row is relabelling rather than fixing.
 *
 * The market nouns are read off the NAME rather than off the sentence, so the
 * Clear River Alliance - the other house named for an intent - is untouched,
 * and a market written into the catalog tomorrow is browsable that day.
 */

import { describe, it, expect } from 'vitest';

import { parseIntent } from '../../src/web/actions';
import { SECTS } from '../../src/data/cultivation/sects';

type Plan = { action?: string; intent?: string; target?: string };
const read = (line: string) => parseIntent(line) as Plan;

/** How a player addresses a house, which is the name without its article. */
const asked = (house: { name: string }) => house.name.replace(/^The\s+/, '');

/**
 * The houses whose own names carry a counter word.
 *
 * Asked of the catalog rather than written down: one house qualifies today and
 * a second one added next year has to be covered by the same rule, which is the
 * whole argument for reading the name instead of listing the house.
 */
const COUNTERS = SECTS.filter(house => /\b(?:market|bazaar|stalls?|exchange)\b/i.test(house.name));

describe('a house whose name is a counter', () => {
    it('has at least one row in the catalog, or this file proves nothing', () => {
        expect(COUNTERS.map(house => house.name).length).toBeGreaterThan(0);
    });

    it.each(['i browse the %s', 'i peruse the %s', 'let me browse the %s'])(
        'can be read across: "%s"', template => {
            for (const house of COUNTERS) {
                const plan = read(template.replace('%s', asked(house)));
                expect(plan.action, `${template} / ${house.name}`).toBe('market');
            }
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

        for (const house of COUNTERS) {
            expect(read(`how far is the ${asked(house)}`).action).toBe('destinations');
            expect(read(`i go to the ${asked(house)}`).action).toBe('move');
        }
    });

    /**
     * THE SENTENCES THAT ALREADY WORKED, WHICH A WIDER VERB LIST WOULD EAT.
     *
     * The market branch runs above both the interact table and the investigate
     * read, so any verb added here takes their sentences silently. These three
     * are the ones that were measured reaching somewhere already, and they are
     * the reason the list is two words long.
     */
    it('leaves the verbs beside it where they were', () => {
        for (const house of COUNTERS) {
            const name = asked(house);
            expect(read(`i haggle at the ${name}`).intent, 'haggle').toBe('trade');
            expect(read(`i look over the ${name}`).action, 'look over').toBe('investigate');
            expect(read(`i look through the ${name}`).action, 'look through')
                .toBe('investigate');
            // A house is still somewhere you resign from, whatever it is called.
            expect(read(`I resign from ${name}`).intent, 'resign').toBe('leave');
            expect(read(`what does the ${name} teach`).intent, 'teach')
                .toBe('what_they_teach');
        }
    });

    /**
     * AND BROWSING A HOUSE THAT IS NOT A COUNTER REACHES NOTHING, which is the
     * correct answer: there is no board at a sect to read across, and inventing
     * one for every house would be the name supplying an intent again, one
     * direction over.
     */
    it('does not make every house a stall', () => {
        const notCounters = SECTS.filter(house => !COUNTERS.includes(house));
        const board = notCounters
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
