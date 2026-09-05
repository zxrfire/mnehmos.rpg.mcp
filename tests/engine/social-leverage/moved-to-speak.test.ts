/**
 * The heavens are heartless, and this is where that becomes arithmetic.
 *
 * The claim under test is the one an implementation breaks by accident: a gift
 * and a robbery of the same fraction of what somebody had must reach the same
 * band, cost the same to answer, and produce the same COUNT of things to say.
 * An implementation with more to say about harm than about generosity has
 * smuggled in a moral weighting and would read plausibly every time.
 *
 * The second claim is the design owner's: *"maybe they say nothing and are
 * stoic, maybe they are emotional."* Both have to be reachable from state, and
 * a channel that always fires reads as a tic within three turns.
 */

import { describe, expect, it } from 'vitest';

import {
    whatThisAsksOfThem,
    whetherTheySayIt,
    BEING_DEALT_WITH,
    SET_BACK,
    SPEAKING_UP_COSTS_EVERYTHING_AT,
    TOUCHED,
    WITNESS_SHARE,
    WORTH_A_SENTENCE,
    type Bearing
} from '../../../src/engine/social-leverage/moved-to-speak';

/** An ordinary person, level with whoever they are answering, untouched. */
function bearing(over: Partial<Bearing> = {}): Bearing {
    return {
        moved: 0,
        bodyLeft: 1,
        rungsOverTheOther: 0,
        backed: false,
        sceneWeight: 0,
        dealtWith: false,
        reticence: 0,
        ...over
    };
}

const SWEEP = [0.02, 0.05, 0.1, 0.2, 0.3, 0.45, 0.6, 0.8, 1];

describe('a gift and a robbery are the same kind of event', () => {
    it('reaches the same weight, the same cost and the same verdict at every size', () => {
        for (const size of SWEEP) {
            const taken = whatThisAsksOfThem(bearing({ moved: -size }));
            const given = whatThisAsksOfThem(bearing({ moved: size }));

            expect(given.weight).toBe(taken.weight);
            expect(given.cost).toBe(taken.cost);
            expect(given.aloud).toBe(taken.aloud);
            // Same shape of answer, different sentence. Both or neither.
            expect(given.reading === null).toBe(taken.reading === null);
            if (given.reading !== null) expect(given.reading).not.toBe(taken.reading);
        }
    });

    it('has exactly as much to say in one direction as in the other', () => {
        const said = (sign: number) => new Set(
            SWEEP.map(size => whatThisAsksOfThem(bearing({ moved: sign * size })).reading)
                .filter((line): line is string => line !== null)
        );
        const taken = said(-1);
        const given = said(1);

        expect(given.size).toBe(taken.size);
        // Three bands over one number, and the thresholds are shared.
        expect(taken.size).toBe(3);
        // And nothing is reused across the two, which is what would silently
        // collapse the symmetry into one voice.
        for (const line of given) expect(taken.has(line)).toBe(false);
    });

    it('puts the two thresholds in the same place for both signs', () => {
        const bandOf = (moved: number) => whatThisAsksOfThem(bearing({ moved })).reading;
        for (const edge of [TOUCHED, SET_BACK]) {
            expect(bandOf(edge)).not.toBe(bandOf(edge - 0.001));
            expect(bandOf(-edge)).not.toBe(bandOf(-(edge - 0.001)));
        }
    });
});

describe('what is worth a sentence at all', () => {
    it('says nothing about somebody nothing happened to', () => {
        expect(whatThisAsksOfThem(bearing()).reading).toBeNull();
        expect(whatThisAsksOfThem(bearing()).aloud).toBe(false);
    });

    it('leaves somebody barely brushed by it out', () => {
        const barely = whatThisAsksOfThem(bearing({ moved: -(WORTH_A_SENTENCE / 2) }));
        expect(barely.reading).toBeNull();
    });

    /**
     * This used to assert that being spoken to was *not, on its own, a reason
     * to answer out loud*. The design owner overruled it: *if i'm talking to a
     * dude then yeah he should say something every turn.* The person a
     * conversation was with was the one participant guaranteed to be silent.
     */
    it('gives the person the other party dealt with an answer', () => {
        const addressed = whatThisAsksOfThem(bearing({ dealtWith: true }));
        expect(addressed.weight).toBe(BEING_DEALT_WITH);
        expect(addressed.reading).not.toBeNull();
        expect(addressed.aloud).toBe(true);
    });

    /**
     * Answering is not speaking up unbidden, so neither temperament nor the
     * ladder decides whether it happens. A stoic answers and somebody twenty
     * rungs beneath the person addressing them answers; what those two facts
     * change is how much of themselves is in it, which is a different clause.
     */
    it('does not put the answer to their temper or to the ladder', () => {
        expect(whatThisAsksOfThem(bearing({ dealtWith: true, reticence: 0.9 })).aloud).toBe(true);
        expect(whatThisAsksOfThem(bearing({ dealtWith: true, rungsOverTheOther: -20 })).aloud)
            .toBe(true);
        // And somebody nobody addressed is still put through the cost.
        expect(whatThisAsksOfThem(bearing({ moved: -0.4, rungsOverTheOther: -20 })).aloud)
            .toBe(false);
    });

    it('does not read somebody who was addressed as a bystander', () => {
        const addressed = whatThisAsksOfThem(bearing({ dealtWith: true, sceneWeight: 0.9 }));
        const watching = whatThisAsksOfThem(bearing({ sceneWeight: 0.9 }));
        expect(addressed.weight).toBe(watching.weight);
        expect(addressed.reading).not.toBe(watching.reading);
    });

    /**
     * And being dealt with must not pin the reading. Raising the floor until it
     * cleared the cost of answering did exactly that: three rounds of a fight
     * wearing somebody down came back as the same sentence three times, because
     * the floor outweighed everything the rounds had actually taken.
     */
    it('leaves the reading to what happened to them', () => {
        const at = (moved: number) =>
            whatThisAsksOfThem(bearing({ dealtWith: true, moved })).reading;
        expect(new Set([at(-0.1), at(-0.4), at(-0.9)]).size).toBe(3);
    });
});

describe('a witness is priced off the loudest thing in the room', () => {
    it('is moved by a share of what they watched, and never by all of it', () => {
        const watching = whatThisAsksOfThem(bearing({ sceneWeight: 1 }));
        expect(watching.weight).toBe(WITNESS_SHARE);
        expect(watching.weight).toBeLessThan(1);
        expect(watching.reading).not.toBeNull();
    });

    it('needs no case of its own for a killing or for a gift', () => {
        // The same number arrives either way, which is the whole argument for
        // pricing witnessing off a magnitude.
        const beside = (sceneWeight: number) => whatThisAsksOfThem(bearing({ sceneWeight }));
        expect(beside(1).reading).toBe(beside(1).reading);
        expect(beside(0.2).weight).toBeLessThan(beside(0.9).weight);
    });

    it('says nothing at all about a room where nothing happened', () => {
        expect(whatThisAsksOfThem(bearing({ sceneWeight: 0.05 })).reading).toBeNull();
    });
});

describe('whether they answer it out loud', () => {
    it('is reachable in both directions from the same event', () => {
        // Something happened to them and nobody put it to them - which is the
        // half of it temperament still decides. Being dealt with is not, and
        // has a case of its own above.
        const event = { moved: -0.8 };
        const open = whatThisAsksOfThem(bearing({ ...event, reticence: -0.9 }));
        const closed = whatThisAsksOfThem(bearing({ ...event, reticence: 0.9 }));

        expect(open.aloud).toBe(true);
        expect(closed.aloud).toBe(false);
        // And the reading is the same either way: what happened to them did
        // not change, only what got out.
        expect(open.reading).toBe(closed.reading);
    });

    it('costs more the further somebody is looking up', () => {
        const near = whatThisAsksOfThem(bearing({ moved: -0.9, rungsOverTheOther: -1 }));
        const far = whatThisAsksOfThem(bearing({
            moved: -0.9,
            rungsOverTheOther: -SPEAKING_UP_COSTS_EVERYTHING_AT
        }));
        expect(far.cost).toBeGreaterThan(near.cost);
        expect(far.aloud).toBe(false);
    });

    it('costs less when their own people are standing there', () => {
        // At the gap where speaking up costs everything, the backing is the
        // whole of the difference between an answer and a swallowed one.
        const gap = { moved: -0.9, rungsOverTheOther: -SPEAKING_UP_COSTS_EVERYTHING_AT };
        const alone = whatThisAsksOfThem(bearing(gap));
        const backed = whatThisAsksOfThem(bearing({ ...gap, backed: true }));
        expect(backed.cost).toBeLessThan(alone.cost);
        expect(backed.aloud).toBe(true);
        expect(alone.aloud).toBe(false);
    });

    it('lets somebody with nothing left talk', () => {
        const whole = whatThisAsksOfThem(bearing({ moved: -0.6, rungsOverTheOther: -5 }));
        const ruined = whatThisAsksOfThem(bearing({
            moved: -0.6, rungsOverTheOther: -5, bodyLeft: 0
        }));
        expect(ruined.cost).toBeLessThan(whole.cost);
        expect(ruined.aloud).toBe(true);
    });

    it('says what the silence looked like rather than dropping the person', () => {
        expect(whetherTheySayIt(false)).toMatch(/not saying is visible/);
        expect(whetherTheySayIt(true)).not.toBe(whetherTheySayIt(false));
    });

    it('is silent far more often than not in an ordinary scene', () => {
        // Twenty-one people spread evenly across the reticence scale, watching
        // something substantial happen to somebody else. A channel where most
        // of them speak is the tic this file exists to avoid.
        const watching = (sceneWeight: number) =>
            Array.from({ length: 21 }, (_, i) => -1 + i * 0.1)
                .filter(reticence => whatThisAsksOfThem(bearing({
                    sceneWeight, reticence
                })).aloud).length;

        expect(watching(0.6)).toBeLessThan(11);
        expect(watching(0.6)).toBeGreaterThan(0);
        // And the loudest thing that can happen in a room gets more of them,
        // which is the direction the arithmetic has to run in. Not all of
        // them: somebody who lets nothing show still lets nothing show.
        expect(watching(1)).toBeGreaterThan(watching(0.6));
        expect(watching(1)).toBeLessThan(21);
    });
});

describe('nothing in it reads a cause', () => {
    it('answers a body it has never seen without a guard', () => {
        const nonsense = whatThisAsksOfThem({
            moved: Number.NaN,
            bodyLeft: Number.POSITIVE_INFINITY,
            rungsOverTheOther: Number.NaN,
            backed: false,
            sceneWeight: Number.NaN,
            dealtWith: false,
            reticence: Number.NaN
        });
        expect(nonsense.weight).toBe(0);
        expect(nonsense.reading).toBeNull();
    });

    it('clamps a movement bigger than everything they had', () => {
        expect(whatThisAsksOfThem(bearing({ moved: -40 })).weight).toBe(1);
        expect(whatThisAsksOfThem(bearing({ moved: 40 })).weight).toBe(1);
    });
});
