/**
 * An empty square with four people standing in it.
 *
 * FOUND BY PLAYING BLIND, turn two of a run, one turn after a market read had
 * named four people selling manuals with their prices:
 *
 *     > i want to learn to cultivate
 *
 *     The air at Autumn Gate is still. There is no one here to provide a
 *     manual, and no one to show the way. To learn is to find a method, and to
 *     find a method is to find a teacher or a book.
 *
 *     A few such things exist within reach... A Lesser Qi-Gathering Manual and
 *     the Azure Dew Gathering Canon are available...
 *
 * The paragraph contradicts itself two sentences apart, and contradicts the
 * previous turn outright: Wei Ciyi, Tang Minya, Shen Minbo and Wei Lielu were
 * all named selling manuals one screen earlier.
 *
 * ── THE CAUSE, AND IT IS AN OMISSION RATHER THAN A LIE ───────────────────
 *
 * The narrator is asked for second-person SCENE prose and was never told who
 * was in the scene. The classifier gets a `STANDING HERE` block listing
 * everybody in the square; the narrator got the place, the air, and a list of
 * proper nouns the cultivator has heard of somewhere in the world. Nothing in
 * its prompt separated an empty square from a busy one - so the opening
 * sentence was a guess every single turn, and the cheapest scene to write from
 * nothing is an empty room.
 *
 * `NOTHING_CAME_BACK` cannot catch this and should not be widened to. That
 * guard is about a question reported as unanswered; here the question was
 * answered two sentences later. The invention is in the SCENE.
 *
 * ── AND IT IS NOT THE CLASSIFIER'S BLOCK HANDED OVER AGAIN ───────────────
 *
 * `describeWhoIsHere` exists to bind a pointing phrase, so it carries rungs,
 * ordinals, ages and sexes and closes on an instruction about targets. Giving
 * a prose writer that table produces precisely the roll call the narration
 * prompt already spends a paragraph forbidding. What a narrator needs is
 * smaller and different in kind: whether the room is empty, and which of the
 * people in it it is allowed to name. This file pins that difference, because
 * the obvious "fix" is to reuse the other block and it would trade one defect
 * for another.
 */

import { describe, it, expect } from 'vitest';

import { composeNarrationUser, describeTheRoom } from '../../src/web/prompt';
import type { Company } from '../../src/web/facts';

const FACTS = {
    headline: 'two arts you could be taught',
    lines: ['A Lesser Qi-Gathering Manual is one a root like yours could take up.'],
    structure: [],
    prose: '',
    required: null
} as const;

const SCENE = { place: 'Autumn Gate', ambient: 'thin' } as const;

function aSquareWith(named: readonly string[], strangers: number): Company {
    return {
        named: named.map((name, i) => ({
            name,
            ordinal: 3,
            sex: 'man',
            age: 40 + i,
            rank: null
        })) as unknown as Company['named'],
        strangers: Array.from({ length: strangers }, () => ({ ordinal: 2 })),
        total: named.length + strangers
    };
}

describe('the prompt says whether anybody is standing here', () => {
    it('names the people in the square', () => {
        const said = describeTheRoom(aSquareWith(['Wei Ciyi', 'Tang Minya'], 0)).join('\n');
        expect(said).toContain('Wei Ciyi');
        expect(said).toContain('Tang Minya');
    });

    /**
     * AND SAYS SO WHEN IT IS ACTUALLY EMPTY, which is the half that keeps this
     * from being a gag order. A cultivator alone on a mountain is alone, and an
     * account of that turn is allowed to say it.
     */
    it('says the room is empty when it is', () => {
        const said = describeTheRoom(aSquareWith([], 0)).join('\n').toLowerCase();
        expect(said).toContain('nobody');
        expect(said).toContain('alone');
    });

    /**
     * THE DISCOVERY GATE IS NOT LOOSENED BY THIS. Somebody whose face this
     * cultivator cannot place has no name to give, and the narrator is told a
     * person is there without being told who - which is exactly what the player
     * can see standing in the square.
     */
    it('counts the faces it cannot place instead of naming them', () => {
        const said = describeTheRoom(aSquareWith(['Wei Ciyi'], 3)).join('\n');
        expect(said).toContain('Wei Ciyi');
        expect(said).toMatch(/3 others whose faces this cultivator cannot place/);
    });

    /**
     * AND IT IS STATED AS A CONSTRAINT. The whole risk of putting a roster in
     * front of a prose writer is that it reads as a list of things to mention.
     */
    it('tells the narrator this is not material to write from', () => {
        const said = describeTheRoom(aSquareWith(['Wei Ciyi'], 0)).join('\n');
        expect(said).toContain('CONSTRAINT');
        expect(said.toLowerCase()).toContain('do not introduce these people');
    });

    /**
     * NOT THE CLASSIFIER'S TABLE. No rungs, no ordinals, no ages, and no
     * instruction about targets: those belong to the block that binds a
     * pointing phrase, and copying them here is how the roll call comes back.
     */
    it('does not hand over the pointing table', () => {
        const said = describeTheRoom(aSquareWith(['Wei Ciyi'], 2)).join('\n').toLowerCase();
        for (const wrong of ['rung', 'ordinal', 'about 4', 'target', 'level with']) {
            expect(said, wrong).not.toContain(wrong);
        }
    });
});

describe('the narration prompt carries it', () => {
    it('puts the room in front of the narrator', () => {
        const prompt = composeNarrationUser(
            FACTS as never,
            { ...SCENE, company: aSquareWith(['Wei Ciyi', 'Tang Minya'], 2) }
        );
        expect(prompt).toContain('WHO IS IN THE ROOM');
        expect(prompt).toContain('Wei Ciyi');
    });

    /**
     * AND IT TELLS THE NARRATOR WHOSE JOB AN ABSENCE IS. The played sentence
     * was not only unsupported, it was the OPPOSITE of what the engine had
     * ruled - so the rule that closes it is about who gets to state a missing
     * thing, not about the square alone.
     */
    it('says an absence is the engine to state', () => {
        const prompt = composeNarrationUser(
            FACTS as never,
            { ...SCENE, company: aSquareWith(['Wei Ciyi'], 0) }
        );
        expect(prompt.toLowerCase()).toContain("an absence is the engine's to state");
    });

    /**
     * A CALLER THAT CANNOT SEE THE SQUARE CHANGES NOTHING. The block is opt-in,
     * the same way `filed` and `hearing` are, so a narration composed without a
     * roster reads exactly as it did before rather than asserting an empty room
     * by omission.
     */
    it('says nothing about the room when the caller did not pass one', () => {
        const prompt = composeNarrationUser(FACTS as never, { ...SCENE });
        expect(prompt).not.toContain('WHO IS IN THE ROOM');
    });
});
