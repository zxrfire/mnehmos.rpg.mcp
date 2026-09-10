/**
 * Somewhere to sit undisturbed is a resource, and it had been free.
 *
 * FOUND BY PLAYING, seed `dm2-2`. A ten-year seclusion, entered in Clear Creek
 * Village with seven people standing in it, ran for 2.1 years and was cut short
 * by nothing but the provisions running out. Nobody looked up. The digest even
 * described "the cave" - there was no cave; the sentence was hardcoded.
 *
 * The design owner:
 *
 *   *"you typically can't cultivate for 20 years in a square"* -
 *   *"someone will tell you to go somewhere else"* -
 *   *"that's like being homeless"* - *"you'll be bugged"*
 *
 * Which is why the genre is full of caves, mountains, sealed halls and rented
 * rooms. A cultivator does not withdraw for a decade because withdrawing is
 * spiritually superior. They withdraw because a decade of sitting still in
 * front of other people is not a thing anybody is allowed to do.
 *
 * NOTHING NEW IS SIMULATED. `randomEventScale` was already documented as
 * *"scales how often those rolls land"* and the seclusion verb set it in
 * exactly one direction - a shut door scaled interruptions DOWN, and nothing
 * ever scaled them up. The clamp says so outright: `Math.min(1, ...)`.
 *
 * The fix is one number read off the roster, and it needed a SECOND field
 * rather than lifting that clamp: `randomEventScale` is a door and a door can
 * only reduce, and raising it would also have made a market square hand out
 * OPPORTUNITIES - the buried ruin, the passing master - which is the opposite
 * of what being watched means. `botheredScale` scales the encounter draw and
 * nothing else, because being seen makes exactly one thing likelier: somebody
 * deciding to do something about you.
 */

import { describe, it, expect } from 'vitest';

import {
    howOftenSittingHereIsInterrupted,
    somewhereYouCouldFinishALongSitting,
    aboutHowLongYouWouldGetHere,
    DAYS_BETWEEN_INTERRUPTIONS_UNWATCHED,
    AS_BOTHERED_AS_IT_GETS
} from '../../../src/engine/cultivation/sitting-down-where-people-can-see-you';
import {
    ENCOUNTER_CHANCE,
    ENCOUNTER_CHECK_DAYS
} from '../../../src/engine/cultivation/time-skip';

describe('how often a sitting here is interrupted', () => {
    /**
     * THE WILDERNESS RATE IS UNCHANGED, which is the half that matters for
     * every place this was always right for. A cave, an empty road and a
     * mountainside all still sit at exactly 1.
     */
    it('leaves an empty place exactly as it was', () => {
        expect(howOftenSittingHereIsInterrupted(0)).toBe(1);
    });

    /**
     * ONE PERSON IS THE LARGEST STEP ON THE SCALE.
     *
     * Not a curve tuned for crowds. The owner's comparison is being homeless,
     * and being homeless is not about crowds - it is about there being anybody
     * at all with standing to ask what you are doing there. One person who
     * walks past every day and wonders is the whole mechanism.
     */
    it('makes the step from nobody to somebody the big one', () => {
        const nobody = howOftenSittingHereIsInterrupted(0);
        const one = howOftenSittingHereIsInterrupted(1);
        const two = howOftenSittingHereIsInterrupted(2);
        expect(one).toBeGreaterThan(nobody);
        // The first person adds more than the second does.
        expect(one - nobody).toBeGreaterThan(two - one);
    });

    it('rises with the number who can see you, and then stops', () => {
        expect(howOftenSittingHereIsInterrupted(3))
            .toBeGreaterThan(howOftenSittingHereIsInterrupted(1));
        expect(howOftenSittingHereIsInterrupted(40)).toBe(AS_BOTHERED_AS_IT_GETS);
        // Past a handful you are already as conspicuous as you are going to
        // get, and what ends the sitting is the FIRST person to say something.
        expect(howOftenSittingHereIsInterrupted(200))
            .toBe(howOftenSittingHereIsInterrupted(40));
    });

    it('treats a negative or fractional count as the count it is', () => {
        expect(howOftenSittingHereIsInterrupted(-5)).toBe(1);
        expect(howOftenSittingHereIsInterrupted(1.9))
            .toBe(howOftenSittingHereIsInterrupted(1));
    });
});

describe('what the multiplier is worth in days', () => {
    /**
     * THE BASE IS NOT AUTHORED TWICE. `DAYS_BETWEEN_INTERRUPTIONS_UNWATCHED` is
     * restated in that module rather than imported, to keep it free of the
     * simulator - so it is pinned against the real constants here instead. If
     * anybody retunes the encounter grid this fails and says so.
     */
    it('agrees with the encounter grid it is derived from', () => {
        expect(DAYS_BETWEEN_INTERRUPTIONS_UNWATCHED)
            .toBe(Math.round(ENCOUNTER_CHECK_DAYS / ENCOUNTER_CHANCE));
    });

    it('says a square buys you a season and a mountain buys you years', () => {
        const alone = aboutHowLongYouWouldGetHere(0);
        const inASquare = aboutHowLongYouWouldGetHere(7);
        expect(alone).toBeGreaterThan(365);
        // Measured on the played seed: a ten-year sitting in a village with
        // seven people in it now runs nine months before somebody comes over.
        // It ran 2.1 undisturbed years before this.
        expect(inASquare).toBeLessThan(120);
    });
});

describe('somewhere a long sitting could actually be finished', () => {
    it('is nowhere anybody can see you', () => {
        expect(somewhereYouCouldFinishALongSitting(0)).toBe(true);
        expect(somewhereYouCouldFinishALongSitting(1)).toBe(false);
        expect(somewhereYouCouldFinishALongSitting(7)).toBe(false);
    });

    /**
     * AND IT IS NOT A GATE. Nothing in this module refuses anything. A player
     * who wants to sit down in the middle of a village is entitled to, and the
     * answer is what happens rather than a refusal. What must not happen - and
     * what did happen - is that nothing does.
     */
    it('never returns a rate that stops the sitting outright', () => {
        for (const watching of [0, 1, 5, 40, 500]) {
            expect(howOftenSittingHereIsInterrupted(watching)).toBeGreaterThan(0);
            expect(Number.isFinite(howOftenSittingHereIsInterrupted(watching))).toBe(true);
        }
    });
});
