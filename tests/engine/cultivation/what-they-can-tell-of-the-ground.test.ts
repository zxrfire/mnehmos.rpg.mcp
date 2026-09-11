/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE FIRST READ THAT KNOWS WHO IS ASKING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A prototype, and the point of it is to find out whether tagging an answer
 * with HOW IT IS KNOWN is worth spreading. The design owner:
 *
 *   *"maybe we split the engine, one to things we can know with certainty,
 *    other to fuzzy?"* - *"then we can just route the request to either certain
 *    or fuzzy depending on what I KNOW and what the npc knows"* -
 *   *"one for feeling one for knowing?"*
 *
 * The distinction is right. Two engines is the trap, and the owner named it in
 * the same breath - *"we do duplicate paths"*. Every worst defect this sweep
 * found was two things answering one question and drifting: a ration footer
 * saying 0 stones over a row holding 16, a pack read saying "nothing at all"
 * over a year of rations, an audit CLI printing 163/546 against a test's
 * 153/496. So: one engine, and the answer carries the tag.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS READ WAS CHOSEN TO PROVE IT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Because the tag changes WHAT IS SAID, not just how it is worded. Anything
 * that only changed the phrasing would prove nothing a style guide could not.
 *
 * `describeAmbientPerceived(ambient)` took the band and nothing else. It had no
 * idea who was standing there, so a sixteen-year-old at the first rung with no
 * method got this on dense ground:
 *
 *     The qi here is thick enough to feel on the first breath. Whatever is
 *     under this ground is close to the surface, and the ground shows signs of
 *     being worked.
 *
 * Two claims a novice could not possibly make: what is under the ground, and
 * that somebody has been working it. The engine knew the band, so the player
 * did. Played, on Nine Peaks, they now get:
 *
 *     The qi here is thicker than anything they have stood in, by enough that
 *     they have no measure for it.
 *
 * Which is better prose AND a smaller claim, and it is not a rewrite - it falls
 * out of asking who is standing there.
 */

import { describe, it, expect } from 'vitest';

import {
    whatTheyCanTellOfTheGround,
    READS_THE_GROUND_AT
} from '../../../src/engine/cultivation/what-they-can-tell-of-the-ground';
import {
    theWeakerOf,
    theyCanTell,
    measured,
    perceived,
    told,
    unknown,
    HOW_TO_PITCH_IT
} from '../../../src/engine/social/how-an-answer-is-known';

const NOVICE = 1;
const FOUNDATION = READS_THE_GROUND_AT;

describe('what a novice can tell of the ground', () => {
    /**
     * THE ONE THAT MATTERS. A novice on dense ground knows it is better than
     * home. They do not know what is under it.
     */
    it('gives a comparison against home, never the band', () => {
        const got = whatTheyCanTellOfTheGround('dense', NOVICE, 'thin');
        expect(got.known).toBe('perceived');
        expect(got.value).toMatch(/thicker than anything they have stood in/);
        // The two claims the band-reading made that a novice cannot.
        expect(got.value).not.toMatch(/under this ground/);
        expect(got.value).not.toMatch(/signs of being worked/);
    });

    it('tells thinner from thicker, in both directions', () => {
        expect(whatTheyCanTellOfTheGround('normal', NOVICE, 'thin').value)
            .toMatch(/better than the ground that raised them/);
        expect(whatTheyCanTellOfTheGround('thin', NOVICE, 'normal').value)
            .toMatch(/thinner than the ground that raised them/);
    });

    /**
     * AND SOMETIMES THERE IS NOTHING TO SAY, WHICH IS THE ANSWER.
     *
     * Somebody raised on thin ground standing on thin ground has no reading to
     * give, because their whole yardstick IS this. `unknown` is not a failure
     * to produce a sentence - it produces a better one, and it is what makes
     * finding somebody who can actually read the ground worth the walk.
     */
    it('says plainly when they have nothing to measure against', () => {
        const got = whatTheyCanTellOfTheGround('thin', NOVICE, 'thin');
        expect(got.known).toBe('unknown');
        expect(theyCanTell(got)).toBe(false);
        expect(got.because).toMatch(/raised on ground like this/);
    });

    it('and when the run does not know where they came from', () => {
        expect(whatTheyCanTellOfTheGround('normal', NOVICE, null).known).toBe('unknown');
    });
});

describe('and what a trained sense gets', () => {
    it('reads the band as a band from the Foundation up', () => {
        const got = whatTheyCanTellOfTheGround('dense', FOUNDATION, 'thin');
        expect(got.known).toBe('measured');
        expect(got.value).toMatch(/thick enough to feel on the first breath/);
    });

    /**
     * THE SAME GROUND, TWO PEOPLE, TWO ANSWERS. This is the whole idea in one
     * assertion: nothing about the world changed between these two calls.
     */
    it('gives two different answers about one piece of ground', () => {
        const low = whatTheyCanTellOfTheGround('dense', NOVICE, 'thin');
        const high = whatTheyCanTellOfTheGround('dense', FOUNDATION, 'thin');
        expect(low.value).not.toBe(high.value);
        expect(low.known).not.toBe(high.known);
    });

    /**
     * AND A TIDE IS EXEMPT FROM THE WHOLE OF IT. Nobody needs a rung to notice
     * that the world changed in the last hour, and everybody local is already
     * moving.
     */
    it('lets anybody feel a spirit tide', () => {
        for (const rung of [NOVICE, FOUNDATION]) {
            const got = whatTheyCanTellOfTheGround('spirit_tide', rung, 'thin');
            expect(theyCanTell(got)).toBe(true);
            expect(got.value).toMatch(/hair lifts/);
        }
    });
});

describe('how an answer is known', () => {
    /**
     * THE RULE THAT MAKES THE TAG WORTH HAVING, rather than decoration.
     *
     * An answer assembled out of others is only as good as the worst of them.
     * Without this a chain of derivations quietly launders a guess into a fact,
     * which is precisely how a raw ordinal ended up in front of a player: each
     * step was locally reasonable and nothing tracked what the whole rested on.
     */
    it('takes the weaker of two ways of knowing', () => {
        expect(theWeakerOf('measured', 'perceived')).toBe('perceived');
        expect(theWeakerOf('perceived', 'told')).toBe('told');
        expect(theWeakerOf('told', 'unknown')).toBe('unknown');
        expect(theWeakerOf('measured', 'measured')).toBe('measured');
        // Symmetric, because "which of these two is worse" cannot depend on
        // the order they were handed over in.
        expect(theWeakerOf('told', 'perceived')).toBe(theWeakerOf('perceived', 'told'));
    });

    it('narrows an answer that has nothing in it', () => {
        expect(theyCanTell(measured(3, 'counted'))).toBe(true);
        expect(theyCanTell(perceived('a wall above you', 'looked'))).toBe(true);
        expect(theyCanTell(told('the sect recruits', 'a stallholder said'))).toBe(true);
        expect(theyCanTell(unknown('four walls up and nothing shows'))).toBe(false);
    });

    /**
     * AND EVERY TAG SAYS HOW TO PITCH A SENTENCE CARRYING IT.
     *
     * The half that replaces per-call-site judgement. `measured` explicitly
     * does NOT license naming the engine's own columns - being certain of a
     * number is not permission to print the field it lives in, and that rule is
     * separate and is not weakened by this one.
     */
    it('carries a register for each way of knowing', () => {
        for (const [tag, pitch] of Object.entries(HOW_TO_PITCH_IT)) {
            expect(pitch.length, tag).toBeGreaterThan(40);
        }
        expect(HOW_TO_PITCH_IT.measured).toMatch(/No hedge/);
        expect(HOW_TO_PITCH_IT.told).toMatch(/Attribute it/);
        expect(HOW_TO_PITCH_IT.unknown).toMatch(/cannot tell/);
    });
});
