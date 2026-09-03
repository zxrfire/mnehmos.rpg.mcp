/**
 * Killing and maiming, in the words a player uses.
 *
 * Found by playing. "I cut Gu Peiyan's throat" came back `unclear`, and a
 * probe of the family found eleven of thirteen phrasings reaching nothing:
 * only `kill X` and `cut him down` worked. So the game answered the word
 * `kill` and nothing else, while the catalog it sits on is emphatic that
 * maiming is worse than robbery, that crippling somebody's cultivation is its
 * own kind of wrong, and that what a person does about being wronged is most
 * of the content.
 *
 * Both directions are pinned, and the second half is the one that matters when
 * somebody widens this later: the verbs here - `cut`, `break`, `open`, `take
 * off` - are ordinary words with ordinary objects, and what makes a sentence
 * violence is the OBJECT being part of a person.
 */
import { describe, expect, it } from 'vitest';
import { parseIntent } from '../../src/web/actions';

describe('violence said the way people say it', () => {
    it('reaches the fight, and reaches it pointed at a person', () => {
        const said: Array<[string, string | undefined]> = [
            ["I cut Gu Peiyan's throat", 'Gu Peiyan'],
            ['I cut her throat', 'her'],
            ['I slit his throat', 'his'],
            ['I break her neck', 'her'],
            ['I stab him', 'him'],
            ['I strangle him', 'him'],
            ['I cut off his arm', 'his'],
            ['I put my knife in his back', 'his'],
            ['I cripple his cultivation', 'his'],
            ['I poison his tea', 'his']
        ];
        for (const [sentence, target] of said) {
            const got = parseIntent(sentence);
            expect(got.action, sentence).toBe('attack');
            // The part is not the person. Before this, "I cut Gu Peiyan's
            // throat" produced a target called `Gu Peiyan's throat`, which
            // resolves against nobody.
            expect(got.target, sentence).toBe(target);
        }
    });

    it('reads a killing as a killing rather than as a brawl', () => {
        // `drive_off` is the intent that stops early, so a throat cut priced as
        // one hands the engine a scuffle where the player described a death.
        for (const sentence of [
            "I cut Gu Peiyan's throat",
            'I cut her throat',
            'I slit his throat',
            'I break her neck',
            'I strangle him',
            // Never matched its own commonest form: `cut down` has a word in
            // the middle of it every time anybody says it.
            'I cut him down'
        ]) {
            expect(parseIntent(sentence).intent, sentence).toBe('kill');
        }
    });

    // The boundary, and the reason the body part is the anchor rather than the
    // verb. Every one of these shares a verb with the block above.
    it('takes nothing from the verb next door', () => {
        for (const sentence of [
            'I cut the rope',
            'I cut some firewood',
            'I cut my losses',
            'I break camp',
            'I take a day off',
            'I open the letter',
            'I take the manual'
        ]) {
            expect(parseIntent(sentence).action, sentence).not.toBe('attack');
        }

        // These have owners, and the owners keep them.
        expect(parseIntent('I break through the barrier').action).toBe('breakthrough');
        expect(parseIntent('I break my oath').action).toBe('oath');
        expect(parseIntent('I gather herbs').action).toBe('gather');
        expect(parseIntent('I take work for a month').action).toBe('work');
    });
});
