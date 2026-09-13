/**
 * A span the engine contrasts with another has to be tellable from it.
 *
 * FOUND BY PLAYING, on a house's ninety-day posting broken off at day 88:
 *
 *     It ran 3 months and not 3 months. Something was already on its way.
 *
 * `humanDays` buckets anything past 60 days into whole months and anything past
 * a year into years, so 88 and 90 both render "3 months". Every guard around
 * these sentences was ALREADY numeric - `asked > skip.requestedDays`,
 * `simulatedDays < requestedDays` - and the numbers really do differ. The
 * defect is one layer further out: the guard decides whether there is anything
 * to say, and then the sentence says it through a formatter that cannot show
 * it. So the engine asserts a difference the reader cannot see, which reads as
 * the engine contradicting itself in a single clause.
 *
 * It is not one sentence. The same shape is in three places on the same screen:
 *
 *     lines     "3 months was asked for; 3 months passed before something
 *                returned control."
 *     prose     "It ran 3 months and not 3 months."
 *     prose     "You came out early. 3 months of the 3 months were spent."
 *
 * and a fourth in `turn-engine`'s `aTermCutShort`, which is the sentence a
 * broken posting closes with.
 *
 * ── WHAT THIS TEST PINS ──────────────────────────────────────────────────
 *
 * Not a wording. The rule: NO SENTENCE SETS A SPAN AGAINST AN IDENTICAL
 * RENDERING OF A SPAN. `twoSpansToldApart` is what enforces it - months where
 * months separate them, days where they do not, and nothing at all where
 * nothing can, which is the honest third case rather than a rounder number.
 *
 * RED-CHECKED: with `twoSpansToldApart` replaced by a bare
 * `[humanDays(a), humanDays(b)]`, both cases below fail on the repeated span.
 */

import { describe, expect, it } from 'vitest';

import { CultivatorSchema, TimeSkipResultSchema } from '../../src/schema/cultivation';
import type { Cultivator, TimeSkipResult } from '../../src/schema/cultivation';
import { factsForTimeSkip } from '../../src/web/facts';

/** A span quoted against another span, whatever unit either was said in. */
const SAID_TWICE = [
    /(\d+(?:\.\d+)? (?:day|month|year)s?) and not \1(?![\d])/i,
    /(\d+(?:\.\d+)? (?:day|month|year)s?) of the \1(?![\d])/i,
    /(\d+(?:\.\d+)? (?:day|month|year)s?) was asked for; \1(?![\d])/i
];

function somebody(): Cultivator {
    return CultivatorSchema.parse({
        id: 'span-subject',
        name: 'Wen Shu',
        spiritRoot: 'single_fire',
        attributes: { might: 2, insight: 2, fortune: 1, charm: 2 },
        hp: 50, maxHp: 50, qi: 20, maxQi: 20,
        age: 30,
        realmOrdinal: 20
    });
}

function aSkip(over: Partial<TimeSkipResult>): TimeSkipResult {
    return TimeSkipResultSchema.parse({
        requestedDays: 90,
        simulatedDays: 90,
        deltas: {
            cultivationProgress: 0, realmOrdinal: 0, hp: 0, qi: 0,
            satiety: 0, spiritStones: 0, age: 0, injuriesGained: 0
        },
        ...over
    });
}

/** Everything the player reads off one span, in one string. */
function everythingSaid(skip: TimeSkipResult, askedForDays?: number): string {
    const who = somebody();
    const facts = factsForTimeSkip(
        who, who, skip, 'normal', 'Sect duty: An escort', askedForDays
    );
    return [facts.headline, ...facts.lines, facts.prose ?? ''].join('\n');
}

describe('a stretch that was cut', () => {
    it('is not set against a span that reads exactly like it', () => {
        // The house asked for 90 days; something interrupting landed on day 88,
        // so the skip was only ever given 88 to run. Both are 3 months.
        const said = everythingSaid(aSkip({ requestedDays: 88, simulatedDays: 88 }), 90);

        for (const shape of SAID_TWICE) {
            expect(said, `said the same span twice: ${shape}`).not.toMatch(shape);
        }
        // And the difference is still STATED. Saying nothing at all here would
        // pass the check above while losing the fact that the term was cut.
        expect(said).toMatch(/88 days and not 90 days/);
    });

    it('says the same of a span the skip itself broke off', () => {
        const said = everythingSaid(
            aSkip({ simulatedDays: 88, interrupted: true, interruptReason: 'encounter' })
        );

        for (const shape of SAID_TWICE) {
            expect(said, `said the same span twice: ${shape}`).not.toMatch(shape);
        }
        expect(said).toMatch(/88 days of the 90 days were spent/);
    });
});
