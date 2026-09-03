/**
 * Somebody else doing the looking makes it a request for care.
 *
 * "I look at this wound" is an examination. "I need SOMEONE to look at this
 * wound" names another party who is to do it, and a sentence with an outside
 * party in it is asking to be treated whatever verb it uses for the treating.
 *
 * The two word orders are why this needs its own patterns. `HAVING_IT_SEEN_TO`
 * wants the injury named before the participle - "get my wounds looked at" -
 * and cannot reach the order where the care verb comes first and the body
 * after it.
 */

import { parseIntent } from '../../src/web/actions';
import { HOW_A_PLAYER_SAYS_EACH_VERB } from '../../src/web/how-a-player-says-each-verb';

const verbFor = (line: string) => (parseIntent(line) as { action: string }).action;

describe('asking to be seen to', () => {
    it('reads a request for somebody to look at a wound as care', () => {
        for (const line of [
            'I need someone to look at this wound',
            'I need someone to look at my wound',
            'someone needs to look at this wound',
            'I find someone to close these wounds'
        ]) {
            expect(verbFor(line), line).toBe('treat');
        }
    });

    it('reads the passive form, which names neither injury nor healer', () => {
        expect(verbFor('I get patched up')).toBe('treat');
        expect(verbFor('I find a doctor and get patched up')).toBe('treat');
    });

    /**
     * A verb's own worked examples are the one set it cannot fail. `I find
     * someone to close these wounds` is listed under `treat` and reached
     * `unclear`.
     */
    it('reaches every phrasing the corpus lists for it', () => {
        for (const line of HOW_A_PLAYER_SAYS_EACH_VERB.treat) {
            expect(verbFor(line), line).toBe('treat');
        }
    });
});

describe('and looking at something is still looking at it', () => {
    it('leaves an examination of your own wound where it was', () => {
        expect(verbFor('I look at this wound')).toBe('investigate');
        expect(verbFor('I examine my wound')).toBe('investigate');
    });

    it('takes nothing from the reads next door', () => {
        expect(verbFor('I look at Bai Xuping')).toBe('investigate');
        expect(verbFor('I look at the manual')).toBe('investigate');
        expect(verbFor('I look around')).toBe('look');
    });

    /** `someone` on its own is not a request for care. */
    it('needs a care verb and a body, not just an indefinite party', () => {
        expect(verbFor('I ask someone about the vein')).not.toBe('treat');
        expect(verbFor('someone is selling a manual')).not.toBe('treat');
    });
});
