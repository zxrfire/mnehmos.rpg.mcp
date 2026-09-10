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
import { theWorstItCouldDo } from '../../src/engine/cultivation/how-a-blow-was-thrown';

describe('violence said the way people say it', () => {
    it('reaches the fight, and reaches it pointed at a person', () => {
        const said: Array<[string, string | undefined]> = [
            ["I cut Gu Peiyan's throat", 'Gu Peiyan'],
            ['I cut her throat', 'her'],
            // AND A BARE POSSESSIVE IS THE PRONOUN IT STANDS FOR.
            //
            // These rows read `'his'` until the possessive was normalised in
            // the parser. `his` is not a person and resolves to nobody, so the
            // possessive phrasings - which is how most of this block is written
            // - reached no one, and the assertion pinned that.
            //
            // The same table already existed in `whoASetHangsOn`, applied when
            // a set is resolved. It is applied once and early now instead.
            // `her` is unchanged because the word is already both.
            ['I slit his throat', 'him'],
            ['I break her neck', 'her'],
            ['I stab him', 'him'],
            ['I strangle him', 'him'],
            ['I cut off his arm', 'him'],
            ['I put my knife in his back', 'him'],
            ['I cripple his cultivation', 'him'],
            ['I poison his tea', 'him']
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

    /**
     * AND A KILLING IS A KILLING BECAUSE OF THE SWING, not because the sentence
     * declared one.
     *
     * This asserted `intent === 'kill'` on every row, and the comment under it
     * read *"`drive_off` is the intent that stops early, so a throat cut priced
     * as one hands the engine a scuffle where the player described a death."*
     * The diagnosis was exactly right and the mechanism was the problem: the
     * fix was to price the sentence as a different GOAL, and a goal is an
     * ending chosen in advance.
     *
     * What is asserted now is that each of these reaches a blow that CAN finish
     * somebody - an edge in a throat, a spine broken, hands closed on a
     * windpipe. Whether it does is the engine's, weighed against the body it
     * lands on. See `how-a-blow-was-thrown.ts`.
     */
    it('reaches a blow that can finish somebody, rather than a brawl', () => {
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
            const thrown = parseIntent(sentence).thrown;
            expect(thrown, sentence).toBeDefined();
            expect(theWorstItCouldDo(thrown!), sentence).toBe('a_death');
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
