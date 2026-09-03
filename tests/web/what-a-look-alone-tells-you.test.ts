/**
 * "Tell" has two meanings and the parser only knew one.
 *
 * Played, with `I look at Bai Xuping` sitting in the live strip at the time:
 *
 *   what can I tell about Bai Xuping just by looking at him?
 *   -> Bai Xuping, approached. Stated intent: talk.
 *   -> "No words were exchanged. Nobody greeted Lin Yuzhen."
 *
 * The only action word in the sentence is LOOKING, and the target came back as
 * "Bai Xuping just by looking at him" - the whole trailing clause swallowed,
 * which is the tell that the wrong verb had claimed it.
 *
 * AND THIS ONE REALLY IS A RANKING FAULT, which is worth pinning because six
 * earlier reports were diagnosed as one and were not. `tell` is in the `talk`
 * intent's verb list and belongs there - "I tell him about the vein" is speech.
 * What was missing is that TO TELL also means TO DISCERN, and the two are told
 * apart by whether anybody is being told: speech takes an indirect object,
 * discernment takes a preposition.
 */

import { parseIntent } from '../../src/web/actions';

const read = (line: string) => parseIntent(line) as {
    action: string; intent?: string; target?: string;
};

describe('asking what a look alone would tell you', () => {
    /** The sentence from the played turn. */
    it('is a look, not an approach', () => {
        const looked = read('what can I tell about Bai Xuping just by looking at him?');
        expect(looked.action).toBe('investigate');
        expect(looked.target).toBe('Bai Xuping');
    });

    /**
     * The manner is stripped rather than carried. "just by looking at him" says
     * HOW somebody is reading, which is not the subject - the same class of
     * thing as "I sit down and read it", one clause smaller.
     */
    it('keeps the manner clause out of the subject', () => {
        for (const line of [
            'what can I tell about Bai Xuping just by looking at him',
            'what can I tell about Bai Xuping by looking at him',
            'what can I tell about Bai Xuping from a distance',
            'what can I tell about Bai Xuping at a glance'
        ]) {
            expect(read(line).target, line).toBe('Bai Xuping');
        }
    });

    /**
     * Either of the two free reads that answer a person, and not a refusal and
     * not an approach. `assess` owns "size up", which is a stronger claim about
     * the same act, and a sentence landing there is answered rather than
     * refused - so the assertion is on the class rather than on one verb.
     */
    it('reaches a read of the person, whichever of the two owns the phrasing', () => {
        for (const line of [
            'what can I tell about Bai Xuping',
            'what do I make of Bai Xuping',
            'what can I gather about Bai Xuping',
            'what could I glean about Bai Xuping'
        ]) {
            expect(['investigate', 'assess'], line).toContain(read(line).action);
        }
    });

    /** And it lands where its sibling already goes. */
    it('agrees with the plain phrasing of the same act', () => {
        expect(read('I look at Bai Xuping').action).toBe('investigate');
        expect(read('what can I tell about Bai Xuping').action).toBe('investigate');
    });
});

/**
 * AND SPEECH KEEPS EVERY SENTENCE THAT IS SPEECH.
 *
 * The preposition is what separates the senses: discernment takes one - tell
 * ABOUT him - and speech takes an indirect object instead. `what can I tell
 * him` is somebody asking what they are permitted to say, and it went to
 * `investigate` until the preposition was made mandatory.
 */
describe('and telling somebody something is still speech', () => {
    it('leaves a sentence with an addressee alone', () => {
        expect(read('what can I tell him').action).toBe('interact');
        expect(read('I tell him about the vein').action).toBe('interact');
        expect(read('I tell Bai Xuping what I saw').action).toBe('interact');
    });

    it('leaves the reads that already owned their phrasing', () => {
        expect(read('tell me about Bai Xuping').action).toBe('investigate');
        expect(read('tell me about myself').action).toBe('status');
        expect(read('what do people say about this place').action).toBe('look');
        expect(read('I talk to Bai Xuping').intent).toBe('talk');
        expect(read('ask Bai Xuping about the manual').intent).toBe('talk');
    });
});
