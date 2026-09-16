/**
 * A span is bounded by the life asking for it, and the refusal carries the number.
 *
 * ── The two defects this closes ──────────────────────────────────────────
 *
 * `MAX_CULTIVATION_DAYS = 36_500` stood where a rule should have been - one
 * flat century for everybody, wrong in both directions at once. A mortal could
 * ask for a hundred years they did not have; somebody who could sit for five
 * hundred could not. The bound is a lifespan, and sitting down until you die is
 * a coherent act, so the longest span anybody may ask for is the WHOLE of what
 * is left, with no margin.
 *
 * And `parseDuration` applied that ceiling in silence. "I cultivate for a
 * thousand years" arrived downstream as 36,500 days, every account of the turn
 * reported a hundred years as the player's own intention, and `durationAskedFor`
 * existed beside it only to recover the figure the first read had destroyed.
 * Silently shortening a span is the agency rule broken from the far side.
 *
 * ── What a refusal has to say ────────────────────────────────────────────
 *
 * Somebody told they may have eighty years has learned where they stand on the
 * ladder and can immediately say the thing they meant. Somebody told "that is
 * too long" has been made to guess. So the engine states the figure, the rung
 * and the age as facts, in the unit the sentence used - a player who typed
 * "a thousand years" is not handed a number of days back.
 *
 * Red-checked by putting the clamp back in `parseDuration` (the thousand-year
 * cases collapse onto 36,500) and by reverting `daysOfLifeRemaining` to the
 * rung's own ceiling (the Profound Yin body stops being refused anything an
 * ordinary one is granted).
 */

import { describe, it, expect } from 'vitest';

import { CultivatorSchema, type Cultivator } from '../../src/schema/cultivation';
import { rankName } from '../../src/engine/cultivation/realms';
import { daysOfLifeRemaining } from '../../src/engine/cultivation/survival';
import {
    aSpanPastTheEndOfThisLife,
    MAX_CULTIVATION_DAYS
} from '../../src/web/verb-day-costs';
import {
    parseDuration,
    durationAskedFor,
    theSpanTheSentenceNames
} from '../../src/web/sentence-parts';

const someone = (overrides: Partial<Cultivator> = {}): Cultivator =>
    CultivatorSchema.parse({
        id: 'asking', name: 'Asking', kind: 'pc', spiritRoot: 'single_fire',
        attributes: { might: 2, insight: 2, fortune: 1, charm: 2 },
        hp: 50, maxHp: 50, qi: 20, maxQi: 20,
        realmOrdinal: 0, age: 16,
        ...overrides
    });

describe('the longest span a body may ask for', () => {
    it('is the whole of what is left, and one day more is refused', () => {
        // Three heights, because a bound that is only checked at the bottom
        // of the ladder is a bound nobody has checked.
        for (const realmOrdinal of [0, 21, 41]) {
            const who = someone({ realmOrdinal, age: 40 });
            const left = daysOfLifeRemaining(who);

            expect(aSpanPastTheEndOfThisLife(who, left), `${realmOrdinal} at the line`)
                .toBeNull();
            expect(aSpanPastTheEndOfThisLife(who, left + 1), `${realmOrdinal} past it`)
                .not.toBeNull();
        }
    });

    it('is not the flat century it used to be, in either direction', () => {
        // A mortal near the end of a hundred-year ceiling cannot have a
        // century, and somebody four realms up can have far more than one.
        const old = someone({ realmOrdinal: 0, age: 90 });
        expect(aSpanPastTheEndOfThisLife(old, MAX_CULTIVATION_DAYS)).not.toBeNull();

        const high = someone({ realmOrdinal: 25, age: 200 });
        expect(daysOfLifeRemaining(high)).toBeGreaterThan(MAX_CULTIVATION_DAYS);
        expect(aSpanPastTheEndOfThisLife(high, MAX_CULTIVATION_DAYS)).toBeNull();
    });

    it('is shorter for a body the physique shortens', () => {
        const ordinary = someone({ physique: null });
        const yin = someone({ physique: 'profound_yin' });

        const span = daysOfLifeRemaining(yin) + 1;
        expect(aSpanPastTheEndOfThisLife(yin, span)).not.toBeNull();
        expect(aSpanPastTheEndOfThisLife(ordinary, span)).toBeNull();
    });
});

describe('the refusal carries the number', () => {
    it('states what is left, the rung and the age', () => {
        const who = someone({ realmOrdinal: 3, age: 40 });
        const said = theSpanTheSentenceNames('I seclude myself for a thousand years')!;
        const refusal = aSpanPastTheEndOfThisLife(who, said.days, said)!;

        expect(refusal).not.toBeNull();
        expect(refusal.daysLeft).toBe(daysOfLifeRemaining(who));
        // Read out of the engine, never typed: any rung name the game prints
        // is one the ladder chose.
        expect(refusal.rank).toBe(rankName(3));
        expect(refusal.line).toContain(rankName(3));
        expect(refusal.line).toContain('age 40');
    });

    it('answers in the unit the sentence asked in', () => {
        const who = someone({ realmOrdinal: 0, age: 16 });

        const inYears = theSpanTheSentenceNames('I cultivate for a thousand years')!;
        const years = aSpanPastTheEndOfThisLife(who, inYears.days, inYears)!;
        expect(years.line).toContain('1000 years was asked for');
        expect(years.line).toContain('84 years');
        expect(years.line).not.toMatch(/\d+ days/);

        const inDays = theSpanTheSentenceNames('I cultivate for 90000 days')!;
        const days = aSpanPastTheEndOfThisLife(who, inDays.days, inDays)!;
        expect(days.line).toContain('90000 days was asked for');
        expect(days.line).toContain('30660 days');
    });
});

describe('the parser reads what was said', () => {
    it('does not shorten a span, at any length', () => {
        expect(parseDuration('I cultivate for a thousand years')).toBe(1000 * 365);
        expect(parseDuration('I cultivate for five hundred years')).toBe(500 * 365);
        expect(parseDuration('I cultivate for 100000 years')).toBe(100_000 * 365);
    });

    it('leaves nothing for a second read to recover', () => {
        // `durationAskedFor` was a second pass over the same sentence, kept
        // only because the first one clamped. There is nothing left to differ.
        for (const said of [
            'I cultivate for 100000 years',
            'I cultivate for ten years',
            'I sit for half a year',
            'I strike the barrier 3 times'
        ]) {
            expect(durationAskedFor(said), said).toBe(parseDuration(said));
        }
    });

    it('still reads a bare count as no span at all', () => {
        expect(parseDuration('I strike the barrier 3 times')).toBeNull();
        expect(theSpanTheSentenceNames('I buy 20 rations')).toBeNull();
    });

    it('carries the unit it read, so an answer can come back in it', () => {
        expect(theSpanTheSentenceNames('I cultivate for three months')?.unit).toBe('month');
        expect(theSpanTheSentenceNames('I cultivate for a decade')?.unit).toBe('decade');
        expect(theSpanTheSentenceNames('I cultivate for two centuries')?.unit).toBe('century');
    });
});
