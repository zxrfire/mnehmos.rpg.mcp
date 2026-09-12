/**
 * `withArt` had one doorway, and it was the least likely sentence.
 *
 * `PlannedAction.withArt` exists, `validatePlan` keeps it on `attack` and
 * `coerce`, and `combat-verbs.ts` resolves it against what the cultivator
 * actually holds. The only phrasing that reached it was `AN_ART_IN_A_SENTENCE`:
 * a Capitalised name after *with* or *using*, at the END of the sentence.
 *
 * Measured over 744 played turns, "I use the luck devouring art on him" reached
 * `unclear` 6 times out of 6. The sentence names an art and names who it is
 * being put on, and it is the shape the genre's own prose uses - the art first,
 * the person after it.
 *
 * ── WHAT IS GATED AND WHY ────────────────────────────────────────────────
 *
 * Not every "use X on Y" is a swing, so the thing being aimed has to read as an
 * art: either it ends in the catalog's own nouns - art, technique, method,
 * palm, fist, step, scripture - or it is Capitalised the way the catalog spells
 * a name. "I use the rope on him" reaches nothing here.
 *
 * NAMING AN ART IS NOT HOLDING ONE. `resolveTechnique` is scoped to what this
 * cultivator carries, and a name that resolves to nothing falls back to what
 * they would actually swing. Nothing in this file widens that.
 */
import { describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/verb-pattern-table';

describe('aiming a named art at somebody', () => {
    it('reaches a verb that keeps the art', () => {
        const plan = parseIntent('I use the luck devouring art on him');
        expect(plan.action).toBe('attack');
        expect(plan.target).toBe('him');
        expect(plan.withArt).toBe('luck devouring');
    });

    it('reads the catalog\'s own spelling, and who it was put on', () => {
        const plan = parseIntent('I use Cross-Meridian Strike on Wen Shu');
        expect(plan.action).toBe('attack');
        expect(plan.target).toBe('Wen Shu');
        expect(plan.withArt).toBe('Cross-Meridian Strike');
    });

    it('still reads the phrasing that already worked', () => {
        const plan = parseIntent('I attack him with Cross-Meridian Strike');
        expect(plan.action).toBe('attack');
        expect(plan.withArt).toBe('Cross-Meridian Strike');
    });

    it('does not turn every use of a thing into a swing', () => {
        for (const said of [
            'I use the rope on the gate',
            'I use my stones on a room'
        ]) {
            expect(parseIntent(said).action, said).not.toBe('attack');
        }
    });
});
