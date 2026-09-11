/**
 * Fifteen years of a forty-year life, gone between the sentence and the verb.
 *
 * FOUND BY PLAYING BLIND. The sentence was:
 *
 *     > i cultivate for twenty years anyway
 *
 * and the fork that ended the stretch reported:
 *
 *     2.4 years of 5.0 are spent, and 2.6 years are still sitting there.
 *
 * Five years. The twenty is never mentioned, on that screen or any other.
 *
 * ── THE PARSER CANNOT READ IT ANY OTHER WAY ──────────────────────────────
 *
 * `parseDuration('i cultivate for twenty years anyway')` is 7300 days, and it
 * is not a judgement call: `twenty` is in the number table and `years` is the
 * unit standing beside it. The span that ran came from the other reader.
 *
 * ── WHY THIS FIELD BREAKS THE RULE THE OTHERS KEEP ───────────────────────
 *
 * Every other field `carryWhatOnlyTheSentenceKnows` carries is carried only
 * where the model volunteered nothing, and that is right: the model is the
 * better reader of what a sentence MEANS, and the parser is the fallback.
 *
 * A number the player typed is not a reading. It is the thing they put on the
 * table, in the same class as `stones` and `rations` - and the only reason
 * those two can use the weaker rule is that the phase-1 prompt never asks for
 * them, so no model ever volunteers one to collide with.
 *
 * The consequence runs both ways and both ways are bad. Short, and a run spends
 * a quarter of what it asked for with nothing on the screen saying so. Long,
 * and a model rounding up spends decades nobody asked for, on a clock that
 * kills.
 *
 * ── AND A DEFAULT IS NOT A SPAN SOMEBODY SAID ────────────────────────────
 *
 * `fromSentence.days` is a DEFAULT on most sentences - `i cultivate` carries
 * `DEFAULT_CULTIVATION_DAYS` and `i go into seclusion` carries
 * `DEFAULT_SECLUSION_DAYS`. Letting one of those override a model's considered
 * span would be this same defect pointing the other way, so the override is
 * guarded on the TEXT naming a duration rather than on the parser producing
 * one.
 */

import { describe, it, expect } from 'vitest';

import { carryWhatOnlyTheSentenceKnows } from '../../src/web/planned-action';
import { parseDuration } from '../../src/web/sentence-parts';
import { DEFAULT_CULTIVATION_DAYS } from '../../src/web/verb-day-costs';

describe('a span the player said in so many words is the span that runs', () => {
    it('is not a judgement call to begin with', () => {
        expect(parseDuration('i cultivate for twenty years anyway')).toBe(7300);
    });

    /**
     * THE PLAYED TURN, as the two readers actually met. A model plan carrying
     * five years against a sentence carrying twenty.
     */
    it('keeps twenty years against a model that said five', () => {
        const merged = carryWhatOnlyTheSentenceKnows(
            { action: 'cultivate', days: 1825 },
            'i cultivate for twenty years anyway'
        );
        expect(merged.days).toBe(7300);
    });

    /**
     * AND THE OTHER DIRECTION, which is the one that kills. A model rounding UP
     * spends years the player never offered, against a lifespan.
     */
    it('keeps one year against a model that said ten', () => {
        const merged = carryWhatOnlyTheSentenceKnows(
            { action: 'cultivate', days: 3650 },
            'i sit for a year'
        );
        expect(merged.days).toBe(365);
    });

    /**
     * AND A SENTENCE THAT NAMED NO SPAN LEAVES THE MODEL'S ALONE. This is the
     * guard that keeps the override narrow: most sentences carry a DEFAULT from
     * the parser, and a default beating a considered span would be the same
     * defect pointing the other way.
     */
    it('does not overwrite a model span with a default', () => {
        const merged = carryWhatOnlyTheSentenceKnows(
            { action: 'cultivate', days: 900 },
            'i sit down and cultivate'
        );
        expect(parseDuration('i sit down and cultivate')).toBeNull();
        expect(merged.days).toBe(900);
        expect(merged.days).not.toBe(DEFAULT_CULTIVATION_DAYS);
    });

    /**
     * AND A MODEL THAT AGREES IS LEFT ALONE. Nothing to assert about behaviour
     * here; it is asserted so that the override cannot be rewritten into
     * something that mutates a plan it did not need to touch.
     */
    it('changes nothing when the two readers agree', () => {
        const plan = { action: 'cultivate' as const, days: 7300 };
        expect(carryWhatOnlyTheSentenceKnows(plan, 'i cultivate for twenty years').days).toBe(7300);
    });

    /**
     * AND A COUNT OF RATIONS IS STILL NOT A SPAN. The rule just above this one
     * DELETES a defaulted span where the sentence names rations instead,
     * because handing `provision` two contradictory instructions is worse than
     * either. This override runs after it and must not put one back.
     *
     * It cannot, and the reason is the same guard: a sentence that names a
     * count of rations and no duration has nothing for `parseDuration` to find,
     * so there is no span to restore. Asserted on the guard rather than on a
     * contrived sentence, because that is the whole of why it holds.
     */
    it('has no span to restore where the sentence named only a count', () => {
        expect(parseDuration('i sit with twelve rations')).toBeNull();
        expect(parseDuration('twelve rations')).toBeNull();
    });
});
