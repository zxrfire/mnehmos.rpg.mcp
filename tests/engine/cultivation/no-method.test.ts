/**
 * Design guards for the sentence that was missing.
 *
 * Measured on the build before this: twelve honest lives, played correctly -
 * stipend, work, food, provisions, treat wounds, sit, strike when the gate
 * opens - ended eleven times in `stagnation_aging` at ordinal 0, age 66, after
 * fifty years of two-year seclusions at 0/100 progress. The rule producing that
 * is correct and is not weakened here. What was missing was any sentence saying
 * so, at any point, anywhere.
 *
 * The failure was specifically a LEGIBILITY one, so these test the words.
 */

import { describe, it, expect } from 'vitest';

import {
    computeCultivationRate,
    techniqueCeiling,
    techniqueExhausted,
    NO_MANUAL_CEILING
} from '../../../src/engine/cultivation/cultivation.js';
import { simulateTimeSkip } from '../../../src/engine/cultivation/time-skip.js';
import { rankName } from '../../../src/engine/cultivation/realms.js';
import { makeCultivator } from './fixtures.js';

describe('the fourth reason a manual fails somebody: there is no manual', () => {
    it('no method and an ended manual are different facts with different labels', () => {
        // The bug, exactly: a cap of 0 and a cap of 13 both returned true from
        // `techniqueExhausted` and both printed "The manual ends at <rung>",
        // naming a book that does not exist.
        const none = techniqueCeiling(0, NO_MANUAL_CEILING);
        const ended = techniqueCeiling(13, 13);

        expect(none.state).toBe('no_method');
        expect(ended.state).toBe('exhausted');
        expect(none.label).not.toBe(ended.label);
        expect(none.line).not.toBe(ended.line);
    });

    it('never tells somebody holding nothing that their manual ended', () => {
        const none = techniqueCeiling(0, NO_MANUAL_CEILING);
        expect(none.label).not.toContain('ends at');
        expect(none.line).not.toContain('ends at');
        // And it must not name a rung as though a book reached it.
        expect(none.label).not.toContain(rankName(0));
    });

    it('the two ends of the axis give OPPOSITE advice', () => {
        // One says go and learn something; the other says go and find the next
        // volume. Advice that pointed the same way would be worse than none.
        expect(techniqueCeiling(0, NO_MANUAL_CEILING).line).toContain('a book, or somebody');
        expect(techniqueCeiling(13, 13).line).toContain('the next volume');
    });

    it('says plainly that more years are not the answer', () => {
        // The lesson a silent stall teaches is "sit longer", which is the exact
        // opposite of the true one.
        const line = techniqueCeiling(0, NO_MANUAL_CEILING).line!;
        expect(line).toContain('not years');
        expect(line).toContain('nothing ever will');
    });

    it('says nothing at all when the manual is still teaching', () => {
        const fine = techniqueCeiling(5, 13);
        expect(fine.state).toBe('teaching');
        expect(fine.line).toBeNull();
        expect(fine.multiplier).toBe(1);
    });

    it('the rule is NOT weakened - progress is still impossible', () => {
        expect(techniqueExhausted(0, NO_MANUAL_CEILING)).toBe(true);
        expect(techniqueCeiling(0, NO_MANUAL_CEILING).multiplier).toBe(0);
        const rate = computeCultivationRate(
            { ...makeCultivator(), realmOrdinal: 0 },
            'normal',
            { techniqueCap: NO_MANUAL_CEILING }
        );
        expect(rate.perDay).toBe(0);
    });

    it('the breakdown line and the narrated sentence are one judgement', () => {
        const rate = computeCultivationRate(
            { ...makeCultivator(), realmOrdinal: 0 },
            'normal',
            { techniqueCap: NO_MANUAL_CEILING }
        );
        const factor = rate.factors.find(f => f.source === 'technique_ceiling');
        expect(factor!.label).toBe(techniqueCeiling(0, NO_MANUAL_CEILING).label);
        expect(factor!.multiplier).toBe(0);
    });
});

describe('it reaches the player, not just the inspector', () => {
    function seclusion(techniqueCap: number | null | undefined, years: number) {
        return simulateTimeSkip(
            makeCultivator({ realmOrdinal: 0, cultivationProgress: 0 }),
            Math.round(years * 365.25),
            {
                seed: 'no-method-guard',
                ambient: 'normal',
                randomEvents: false,
                grainAbstinence: true,
                options: techniqueCap === undefined ? {} : { techniqueCap }
            }
        );
    }

    it('a two-year seclusion with no method SAYS SO', () => {
        // The whole point. A player sat for fifty years and the digest never
        // mentioned the one fact that explained all of it.
        const result = seclusion(NO_MANUAL_CEILING, 2);
        const said = result.events.filter(e => e.kind === 'method_ceiling');
        expect(said.length).toBe(1);
        expect(said[0].data.state).toBe('no_method');
        expect(said[0].summary).toContain('no cultivation method at all');
    });

    it('says it once across a long seclusion, not once per chunk', () => {
        // A digest that repeats one warning forty times has buried everything
        // else it said.
        const result = seclusion(NO_MANUAL_CEILING, 50);
        expect(result.events.filter(e => e.kind === 'method_ceiling').length).toBe(1);
    });

    it('does not interrupt - being told is not a reason to stop the seclusion', () => {
        const result = seclusion(NO_MANUAL_CEILING, 2);
        const said = result.events.find(e => e.kind === 'method_ceiling')!;
        expect(said.interrupts).toBe(false);
        // And the days must still pass, or a stalled cultivator could not
        // spend time at all.
        expect(result.simulatedDays).toBeGreaterThan(600);
    });

    it('stays quiet for somebody whose manual is still teaching', () => {
        const result = seclusion(13, 2);
        expect(result.events.some(e => e.kind === 'method_ceiling')).toBe(false);
    });

    it('stays quiet for a caller that declared no cap at all', () => {
        // Legacy behaviour: `undefined` means "no manual declared", which is
        // not the same as "no manual held", and must not be narrated as one.
        const result = seclusion(undefined, 2);
        expect(result.events.some(e => e.kind === 'method_ceiling')).toBe(false);
    });
});

describe('a copy in the bag is not a road, and it is not an absence either', () => {
    // Found by playing. Two copies bought at one stall for twelve spirit
    // stones, and the sheet then said what was missing was "a book" - pointing
    // the player at a purchase they had already made twice. `buy`'s own ruling
    // had said it in the same session: "the copy is now held and the art is
    // not: owning it and having sat down with it are separate facts."
    it('does not send somebody carrying an unopened copy to go and find a book', () => {
        const carrying = techniqueCeiling(0, NO_MANUAL_CEILING, true);

        expect(carrying.state).toBe('no_method');
        expect(carrying.line).toMatch(/never opened/i);
        // The errand, which is `learn` and is free - not another trip to a stall.
        expect(carrying.line).not.toMatch(/It is a book/);
        expect(carrying.line).not.toMatch(/willing to teach them one/);
    });

    it('still says find a book to somebody who holds none', () => {
        const empty = techniqueCeiling(0, NO_MANUAL_CEILING);

        expect(empty.line).toMatch(/It is a book, or somebody willing to teach them one/);
        expect(empty.line).not.toMatch(/never opened/i);
    });

    it('leaves the two halves saying different things, which is the whole point', () => {
        const carrying = techniqueCeiling(0, NO_MANUAL_CEILING, true);
        const empty = techniqueCeiling(0, NO_MANUAL_CEILING, false);

        expect(carrying.line).not.toBe(empty.line);
        // Both are still the same STATE and the same stop. Nothing accumulates
        // either way; only the errand differs.
        expect(carrying.state).toBe(empty.state);
        expect(carrying.multiplier).toBe(0);
        expect(empty.multiplier).toBe(0);
    });

    it('defaults to the empty-handed wording, so a caller that cannot see a pouch is unchanged', () => {
        expect(techniqueCeiling(0, NO_MANUAL_CEILING).line)
            .toBe(techniqueCeiling(0, NO_MANUAL_CEILING, false).line);
    });

    // Above the Lid a book is not the answer at all, and that sentence must not
    // acquire a copy-in-the-bag branch: there is nothing for a manual to carry
    // anybody to up there, whether they hold one or not.
    it('says nothing about a held copy above the Lid, where no book is the answer', () => {
        const above = techniqueCeiling(46, NO_MANUAL_CEILING, true);

        expect(above.line).toMatch(/It is what they understand/);
        expect(above.line).not.toMatch(/never opened/i);
    });
});
