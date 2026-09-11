/**
 * A rung has more than one name and the guard knew three of them.
 *
 * FOUND BY PLAYING against the local narrator model. It wrote, of a cultivator
 * standing at Qi Condensation Layer 1 with no manual:
 *
 *     You have reached the first rung of Qi Condensation, but you hold no manual.
 *
 * True in both halves. `auditNarration` discarded the whole opening as an
 * invented breakthrough, because `namesTheRungTheyAreOn` knew `layer`, `rank`
 * and `stage` and not `rung` - which is the engine's OWN word: its intake
 * notices read "and not from the first rung of it".
 *
 * The prompt orders the narrator to write every fact again from nothing, so a
 * guard that only recognises the engine's spelling discards the prose that
 * obeyed it.
 */

import { describe, expect, it } from 'vitest';
import { auditNarration } from '../../src/web/narrator';

const AT_LAYER_ONE = { who: 'Shen Wuyou', standsAt: 'Qi Condensation Layer 1' };

describe('the rung you stand on, said in the genre words', () => {
    it('allows the rung the engine filed, however the narrator spells it', () => {
        for (const said of [
            'You have reached the first rung of Qi Condensation, but you hold no manual.',
            'You have reached the first layer of Qi Condensation.',
            'You reached Qi Condensation Layer 1 and nothing since.',
            'You have attained the first level of Qi Condensation.'
        ]) {
            expect(auditNarration(said, AT_LAYER_ONE), said).toHaveLength(0);
        }
    });

    /**
     * AND IT IS STILL A REAL GUARD. A rung the engine did not file is still a
     * fabrication whichever word carries it, or the fix above would have bought
     * readability by turning the check off.
     */
    it('still catches a rung the engine did not file', () => {
        for (const said of [
            'You have reached the third rung of Qi Condensation.',
            'You have reached the second layer of Qi Condensation.',
            'You have reached Foundation Establishment.'
        ]) {
            expect(auditNarration(said, AT_LAYER_ONE), said).not.toHaveLength(0);
        }
    });

    /**
     * The guard is skipped entirely when the caller files nothing, which is how
     * the opening escaped it until turn 0 began filing an outcome for the
     * name-leak check. Pinned so the interaction is visible.
     */
    it('checks nothing when the caller filed nothing', () => {
        expect(auditNarration('You have reached the ninth rung.', null)).toHaveLength(0);
    });
});
